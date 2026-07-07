import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { appointments, doctors } from "@/db/schema";
import { eq, and, gte, lt, desc } from "drizzle-orm";

export const getMyAppointments = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    return db.query.appointments.findMany({
      where: eq(appointments.patientId, data.userId),
      with: {
        doctor: {
          with: { specialty: true },
        },
      },
      orderBy: [desc(appointments.scheduledAt)],
    });
  });

export const getDoctorAppointments = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    const doctor = await db.query.doctors.findFirst({
      where: eq(doctors.userId, data.userId),
    });

    if (!doctor) {
      throw new Error("No se encontró perfil de médico");
    }

    return db.query.appointments.findMany({
      where: eq(appointments.doctorId, doctor.id),
      with: {
        patient: true,
        specialty: true,
      },
      orderBy: [desc(appointments.scheduledAt)],
    });
  });

export const getStaffAppointments = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      date: z.string().optional(),
      status: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const conditions = [];
    if (data.date) {
      const dayStart = new Date(data.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(data.date);
      dayEnd.setHours(23, 59, 59, 999);
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

    return db.query.appointments.findMany({
      where,
      with: {
        patient: true,
        doctor: { with: { specialty: true, user: true } },
        specialty: true,
      },
      orderBy: [desc(appointments.scheduledAt)],
    });
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
    const scheduledDate = new Date(data.scheduledAt);
    const endDate = new Date(scheduledDate.getTime() + data.durationMinutes * 60000);

    const existing = await db.query.appointments.findFirst({
      where: and(eq(appointments.doctorId, data.doctorId), eq(appointments.status, "pendiente")),
    });

    if (existing) {
      const existingStart = new Date(existing.scheduledAt);
      const existingEnd = new Date(
        existingStart.getTime() + (existing.durationMinutes ?? 30) * 60000,
      );
      if (scheduledDate < existingEnd && endDate > existingStart) {
        throw new Error("El horario seleccionado ya está reservado para este profesional");
      }
    }

    const [newAppointment] = await db
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

export const cancelAppointment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ appointmentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await db
      .update(appointments)
      .set({ status: "cancelado", updatedAt: new Date() })
      .where(eq(appointments.id, data.appointmentId));

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
    const dayStart = new Date(data.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(data.date);
    dayEnd.setHours(23, 59, 59, 999);

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
    await db
      .update(appointments)
      .set({
        scheduledAt: new Date(data.scheduledAt),
        durationMinutes: data.durationMinutes,
        status: "pendiente",
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, data.appointmentId));

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
    await db
      .update(appointments)
      .set({ status: data.status, updatedAt: new Date() })
      .where(eq(appointments.id, data.appointmentId));

    return { success: true };
  });
