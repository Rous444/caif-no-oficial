import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { appointments, doctors, doctorSchedules } from "@/db/schema";
import { eq, and, gte, lt, desc, ne } from "drizzle-orm";
import { throwIfSoftlocked } from "@/lib/softlock";
import { requireSession, requireRole, requireDoctor, AuthError } from "./_guards";
import {
  isValidTransition,
  rangesOverlap,
  deriveDisplayStatus,
  isWithinDoctorSchedule,
  type AppointmentStatus,
} from "@/lib/appointment-state";
import { SlotTakenError, StaleStateError, InvalidTransitionError } from "@/lib/errors";

function dayBounds(date: Date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return { dayStart, dayEnd };
}

// Postgres unique_violation (23505) / exclusion_violation (23P01): red de
// seguridad si el constraint de DB (Plan 03, migración pospuesta durante la
// carga de datos — ver docs/03-integridad-ciclo-de-vida-turno.md) ya está
// aplicado. Sin el constraint, el chequeo en la transacción es la única
// defensa; con él, esto evita que la violación llegue como error 500 crudo.
function isOverlapViolation(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "23505" || code === "23P01";
}

async function requireAppointmentStaffAccess(appointmentId: string) {
  const session = await requireSession();
  const appointment = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
  });
  if (!appointment) throw new Error("Turno no encontrado");

  if (session.user.role === "medico") {
    const doctor = await db.query.doctors.findFirst({
      where: eq(doctors.userId, session.user.id),
    });
    if (!doctor || appointment.doctorId !== doctor.id) {
      throw new AuthError("FORBIDDEN", "No autorizado");
    }
  } else if (session.user.role !== "recepcionista" && session.user.role !== "admin") {
    throw new AuthError("FORBIDDEN", "No autorizado");
  }

  return { session, appointment };
}

// Auto-asistido (§4.5): no persiste nada, solo agrega `displayStatus` para
// que la UI muestre "completado" en turnos viejos sin marca de "ausente".
function withDisplayStatus<T extends { status: AppointmentStatus | null; scheduledAt: Date }>(
  appts: T[],
) {
  const now = new Date();
  return appts.map((a) => ({
    ...a,
    displayStatus: deriveDisplayStatus((a.status ?? "pendiente") as AppointmentStatus, a.scheduledAt, now),
  }));
}

export const getMyAppointments = createServerFn({ method: "POST" }).handler(async () => {
  const session = await requireSession();
  const results = await db.query.appointments.findMany({
    where: eq(appointments.patientId, session.user.id),
    with: {
      doctor: {
        with: { specialty: true, user: true },
      },
    },
    orderBy: [desc(appointments.scheduledAt)],
  });
  return withDisplayStatus(results);
});

export const getDoctorAppointments = createServerFn({ method: "POST" }).handler(async () => {
  const { doctorId } = await requireDoctor();

  const results = await db.query.appointments.findMany({
    where: eq(appointments.doctorId, doctorId),
    with: {
      patient: true,
      specialty: true,
    },
    orderBy: [desc(appointments.scheduledAt)],
  });
  return withDisplayStatus(results);
});

export const getStaffAppointments = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      date: z.string().optional(),
      status: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireRole("recepcionista", "admin");

    const conditions = [];
    if (data.date) {
      // Parse YYYY-MM-DD from date input and create dates in local timezone
      const [year, month, day] = data.date.split("-").map(Number);
      const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
      const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
      conditions.push(gte(appointments.scheduledAt, dayStart));
      conditions.push(lt(appointments.scheduledAt, dayEnd));
    }
    if (data.status) {
      conditions.push(
        eq(
          appointments.status,
          data.status as "pendiente" | "confirmado" | "cancelado" | "completado" | "ausente",
        ),
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db.query.appointments.findMany({
      where,
      with: {
        patient: true,
        doctor: { with: { specialty: true, user: true } },
        specialty: true,
      },
      orderBy: [desc(appointments.scheduledAt)],
    });
    return withDisplayStatus(results);
  });

export const bookAppointment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      patientId: z.string(),
      doctorId: z.string().uuid(),
      specialtyId: z.string().uuid(),
      scheduledAt: z.string(),
      durationMinutes: z.number().default(30),
    }),
  )
  .handler(async ({ data }) => {
    const session = await requireSession();
    if (data.patientId !== session.user.id) {
      await requireRole("recepcionista", "medico", "admin");
    }

    throwIfSoftlocked();

    const scheduledDate = new Date(data.scheduledAt);
    const endDate = new Date(scheduledDate.getTime() + data.durationMinutes * 60000);

    if (scheduledDate.getTime() < Date.now()) {
      throw new Error("No se puede reservar un turno en el pasado");
    }

    try {
      return await db.transaction(async (tx) => {
        const { dayStart, dayEnd } = dayBounds(scheduledDate);
        const existing = await tx.query.appointments.findMany({
          where: and(
            eq(appointments.doctorId, data.doctorId),
            ne(appointments.status, "cancelado"),
            gte(appointments.scheduledAt, dayStart),
            lt(appointments.scheduledAt, dayEnd),
          ),
        });

        for (const appt of existing) {
          const existingStart = new Date(appt.scheduledAt);
          const existingEnd = new Date(
            existingStart.getTime() + (appt.durationMinutes ?? 30) * 60000,
          );
          if (rangesOverlap(scheduledDate, endDate, existingStart, existingEnd)) {
            throw new SlotTakenError();
          }
        }

        const [newAppointment] = await tx
          .insert(appointments)
          .values({
            patientId: data.patientId,
            doctorId: data.doctorId,
            specialtyId: data.specialtyId,
            scheduledAt: scheduledDate,
            durationMinutes: data.durationMinutes,
            status: "pendiente",
          })
          .returning();

        return newAppointment;
      });
    } catch (err) {
      if (err instanceof SlotTakenError) throw err;
      if (isOverlapViolation(err)) throw new SlotTakenError();
      throw err;
    }
  });

export const cancelAppointment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ appointmentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await requireSession();
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, data.appointmentId),
    });
    if (!appointment) throw new Error("Turno no encontrado");
    if (appointment.patientId !== session.user.id) {
      await requireRole("recepcionista", "medico", "admin");
    }

    const currentStatus = appointment.status as AppointmentStatus;
    if (!isValidTransition(currentStatus, "cancelado")) {
      throw new InvalidTransitionError(`No se puede cancelar un turno "${currentStatus}"`);
    }

    const updated = await db
      .update(appointments)
      .set({ status: "cancelado", updatedAt: new Date() })
      .where(and(eq(appointments.id, data.appointmentId), eq(appointments.status, currentStatus)))
      .returning({ id: appointments.id });

    if (updated.length === 0) {
      throw new StaleStateError();
    }

    return { success: true };
  });

export const getDayAppointments = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      doctorId: z.string().uuid(),
      date: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    await requireSession();

    // Parse YYYY-MM-DD from date input and create dates in local timezone
    const [year, month, day] = data.date.split("-").map(Number);
    const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

    return db
      .select({
        scheduledAt: appointments.scheduledAt,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, data.doctorId),
          gte(appointments.scheduledAt, dayStart),
          lt(appointments.scheduledAt, dayEnd),
          ne(appointments.status, "cancelado"),
        ),
      );
  });

export const rescheduleAppointment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      appointmentId: z.string().uuid(),
      scheduledAt: z.string(),
      durationMinutes: z.number().int().min(10).max(120),
    }),
  )
  .handler(async ({ data }) => {
    const { appointment } = await requireAppointmentStaffAccess(data.appointmentId);
    throwIfSoftlocked();

    const scheduledDate = new Date(data.scheduledAt);
    const endDate = new Date(scheduledDate.getTime() + data.durationMinutes * 60000);

    if (scheduledDate.getTime() < Date.now()) {
      throw new Error("No se puede reprogramar a un horario en el pasado");
    }

    const schedules = await db.query.doctorSchedules.findMany({
      where: eq(doctorSchedules.doctorId, appointment.doctorId),
    });
    if (!isWithinDoctorSchedule(scheduledDate, data.durationMinutes, schedules)) {
      throw new Error("El horario seleccionado está fuera de la disponibilidad del profesional");
    }

    try {
      await db.transaction(async (tx) => {
        const { dayStart, dayEnd } = dayBounds(scheduledDate);
        const existing = await tx.query.appointments.findMany({
          where: and(
            eq(appointments.doctorId, appointment.doctorId),
            ne(appointments.status, "cancelado"),
            ne(appointments.id, data.appointmentId),
            gte(appointments.scheduledAt, dayStart),
            lt(appointments.scheduledAt, dayEnd),
          ),
        });

        for (const appt of existing) {
          const existingStart = new Date(appt.scheduledAt);
          const existingEnd = new Date(
            existingStart.getTime() + (appt.durationMinutes ?? 30) * 60000,
          );
          if (rangesOverlap(scheduledDate, endDate, existingStart, existingEnd)) {
            throw new SlotTakenError();
          }
        }

        await tx
          .update(appointments)
          .set({
            scheduledAt: scheduledDate,
            durationMinutes: data.durationMinutes,
            status: "pendiente",
            updatedAt: new Date(),
          })
          .where(eq(appointments.id, data.appointmentId));
      });
    } catch (err) {
      if (err instanceof SlotTakenError) throw err;
      if (isOverlapViolation(err)) throw new SlotTakenError();
      throw err;
    }

    return { success: true };
  });

export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      appointmentId: z.string().uuid(),
      status: z.enum(["pendiente", "confirmado", "cancelado", "completado", "ausente"]),
    }),
  )
  .handler(async ({ data }) => {
    const { appointment } = await requireAppointmentStaffAccess(data.appointmentId);
    const currentStatus = appointment.status as AppointmentStatus;

    if (!isValidTransition(currentStatus, data.status)) {
      throw new InvalidTransitionError(
        `No se puede pasar de "${currentStatus}" a "${data.status}"`,
      );
    }

    const updated = await db
      .update(appointments)
      .set({ status: data.status, updatedAt: new Date() })
      .where(and(eq(appointments.id, data.appointmentId), eq(appointments.status, currentStatus)))
      .returning({ id: appointments.id });

    if (updated.length === 0) {
      throw new StaleStateError();
    }

    return { success: true };
  });
