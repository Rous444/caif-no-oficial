import { db } from "@/db";
import { appointments, doctors, user, specialties } from "@/db/schema";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// Estados que deben aparecer en el turnero del médico (decisión confirmada, C5):
// tanto los `pendiente` como los que recepción ya `confirmado`.
const TURNERO_STATUSES = ["pendiente", "confirmado"] as const;

export type TurneroRow = {
  hora: string;
  paciente: string;
  medico: string;
  especialidad: string;
};

export function getArgentinaTomorrow(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const today = new Date(year, month, day);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

// Fecha del turnero de mañana como `YYYY-MM-DD` (calendario ARG). Se usa como clave
// estable en `whatsapp_log` para deduplicar entre el envío de las 21:00 y el reintento.
export function getArgentinaTomorrowISO(): string {
  const t = getArgentinaTomorrow();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function getTomorrowAppointments(): Promise<TurneroRow[]> {
  const tomorrow = getArgentinaTomorrow();
  const startOfDay = new Date(tomorrow);
  const endOfDay = new Date(tomorrow);
  endOfDay.setDate(endOfDay.getDate() + 1);

  // Q4: el nombre del médico sale del usuario del médico (doctors.userId → user),
  // no del usuario del paciente. Se usa un alias para unir `user` dos veces.
  const doctorUser = alias(user, "doctor_user");

  const rows = await db
    .select({
      scheduledAt: appointments.scheduledAt,
      patientFirstName: user.firstName,
      patientLastName: user.lastName,
      doctorFirstName: doctorUser.firstName,
      doctorLastName: doctorUser.lastName,
      specialtyName: specialties.name,
    })
    .from(appointments)
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .innerJoin(user, eq(appointments.patientId, user.id))
    .innerJoin(doctorUser, eq(doctors.userId, doctorUser.id))
    .innerJoin(specialties, eq(appointments.specialtyId, specialties.id))
    .where(
      and(
        gte(appointments.scheduledAt, startOfDay),
        lt(appointments.scheduledAt, endOfDay),
        inArray(appointments.status, [...TURNERO_STATUSES]),
      ),
    )
    .orderBy(appointments.scheduledAt);

  return rows.map((r) => ({
    hora: r.scheduledAt.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    }),
    paciente: `${r.patientFirstName} ${r.patientLastName}`,
    medico: `${r.doctorFirstName} ${r.doctorLastName}`,
    especialidad: r.specialtyName,
  }));
}

export type DoctorAppointmentGroup = {
  doctorId: string;
  doctorName: string;
  phone: string;
  appointments: { hora: string; paciente: string }[];
};

export async function getTomorrowAppointmentsByDoctor(): Promise<DoctorAppointmentGroup[]> {
  const tomorrow = getArgentinaTomorrow();
  const startOfDay = new Date(tomorrow);
  const endOfDay = new Date(tomorrow);
  endOfDay.setDate(endOfDay.getDate() + 1);

  // C5: incluir `pendiente` + `confirmado` (no sólo `pendiente`).
  const rows = await db
    .select({
      scheduledAt: appointments.scheduledAt,
      doctorId: appointments.doctorId,
      patientFirstName: user.firstName,
      patientLastName: user.lastName,
    })
    .from(appointments)
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .innerJoin(user, eq(appointments.patientId, user.id))
    .where(
      and(
        gte(appointments.scheduledAt, startOfDay),
        lt(appointments.scheduledAt, endOfDay),
        inArray(appointments.status, [...TURNERO_STATUSES]),
      ),
    )
    .orderBy(appointments.scheduledAt);

  // Collect unique doctor IDs from appointments
  const doctorIds = [...new Set(rows.map((r) => r.doctorId))];

  if (doctorIds.length === 0) return [];

  // Get doctors with whatsappNotifications enabled + their phone
  const doctorsWithOptIn = await db
    .select({
      id: doctors.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      whatsappNotifications: doctors.whatsappNotifications,
    })
    .from(doctors)
    .innerJoin(user, eq(doctors.userId, user.id))
    .where(
      and(
        inArray(doctors.id, doctorIds),
        eq(doctors.whatsappNotifications, true),
        eq(doctors.isActive, true),
      ),
    );

  // Group appointments by doctor
  const result: DoctorAppointmentGroup[] = [];

  for (const doc of doctorsWithOptIn) {
    const appts = rows
      .filter((r) => r.doctorId === doc.id)
      .map((r) => ({
        hora: r.scheduledAt.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Argentina/Buenos_Aires",
        }),
        paciente: `${r.patientFirstName} ${r.patientLastName}`,
      }));

    const doctorName = `${doc.firstName} ${doc.lastName}`;

    result.push({
      doctorId: doc.id,
      doctorName,
      phone: doc.phone,
      appointments: appts,
    });
  }

  return result;
}
