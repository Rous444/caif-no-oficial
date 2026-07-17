export type AppointmentStatus = "pendiente" | "confirmado" | "cancelado" | "completado" | "ausente";

export type AgendaAppt = {
  id: string;
  scheduledAt: Date;
  durationMinutes: number | null;
  status: AppointmentStatus;
  displayStatus?: AppointmentStatus;
  notes: string | null;
  specialty: { name: string } | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  } | null;
  doctor?: {
    id: string;
    user: { id: string; firstName: string; lastName: string; name: string | null } | null;
    specialty: { name: string } | null;
    insuranceCompanies: string[] | null;
  } | null;
};

export function statusBg(s: AppointmentStatus) {
  switch (s) {
    case "confirmado":
      return "bg-teal/15 text-teal";
    case "pendiente":
      return "bg-accent/30 text-secondary";
    case "cancelado":
      return "bg-destructive/10 text-destructive line-through";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// Left-border color for the agenda grid blocks — same status mapping as
// statusBg, expressed as a border color so it reads at a glance without
// needing to read the badge text.
export function statusBorder(s: AppointmentStatus) {
  switch (s) {
    case "confirmado":
      return "border-l-teal";
    case "pendiente":
      return "border-l-secondary";
    case "cancelado":
      return "border-l-destructive";
    default:
      return "border-l-muted-foreground";
  }
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
export const fmtTime = (d: Date) =>
  d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
