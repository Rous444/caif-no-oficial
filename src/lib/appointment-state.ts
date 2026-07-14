// Lógica pura del ciclo de vida del turno (Plan 03, §4.5 del relevamiento).
// Sin acceso a DB para poder testear sin infraestructura.

export type AppointmentStatus = "pendiente" | "confirmado" | "cancelado" | "completado" | "ausente";

// "completado" nunca es una transición manual: llega únicamente por la
// regla de auto-asistido lazy (deriveDisplayStatus), nunca vía click/API.
const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pendiente: ["confirmado", "cancelado"],
  confirmado: ["ausente", "cancelado"],
  cancelado: [],
  completado: [],
  ausente: [],
};

export function isValidTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

// Minutos post-horario sin marca de "ausente" tras los cuales el turno se
// considera asistido (§4.5 del relevamiento, confirmado con el cliente).
export const AUTO_ATTENDED_MINUTES = 15;

// Cálculo lazy: no persiste nada, solo deriva qué mostrar. Un turno
// pendiente/confirmado cuyo horario + N minutos ya pasó y no fue marcado
// "ausente" se muestra como "completado" (asistido).
export function deriveDisplayStatus(
  status: AppointmentStatus,
  scheduledAt: Date,
  now: Date = new Date(),
): AppointmentStatus {
  if (status !== "pendiente" && status !== "confirmado") return status;
  const cutoff = new Date(scheduledAt.getTime() + AUTO_ATTENDED_MINUTES * 60000);
  return now >= cutoff ? "completado" : status;
}

export interface DoctorScheduleBlock {
  weekday: number;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export function isWithinDoctorSchedule(
  scheduledAt: Date,
  durationMinutes: number,
  schedules: DoctorScheduleBlock[],
): boolean {
  const weekday = scheduledAt.getDay();
  const startMinutes = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
  const endMinutes = startMinutes + durationMinutes;

  return schedules.some((s) => {
    if (s.weekday !== weekday) return false;
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    const blockStart = sh * 60 + sm;
    const blockEnd = eh * 60 + em;
    return startMinutes >= blockStart && endMinutes <= blockEnd;
  });
}
