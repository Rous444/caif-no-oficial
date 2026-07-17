import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Plus, Stethoscope, User, Building2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { isSoftlocked } from "@/lib/softlock";

import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  getMyAppointments,
  cancelAppointment,
  bookAppointment,
  getDayAppointments,
} from "@/lib/api/appointments.functions";
import { getActiveSpecialties } from "@/lib/api/specialties.functions";
import { getDoctorsBySpecialty } from "@/lib/api/admin-doctors.functions";
import { getDoctorSchedule } from "@/lib/api/doctor-schedule.functions";
import { ProfileEditor } from "@/components/ProfileEditor";
import { generateSlots } from "@/lib/slots";
import { formatArPhone, toWaLink } from "@/lib/phone";
import { toastError } from "@/lib/toastError";
export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Mi panel · CAIF" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, loading, roles, hasRole } = useAuth();
  const navigate = useNavigate();
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const { data: appointments, refetch } = useQuery({
    queryKey: ["my-appointments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      return getMyAppointments();
    },
  });

  const cancelAppt = async (id: string) => {
    try {
      await cancelAppointment({ data: { appointmentId: id } });
      toast.success("Turno cancelado");
      refetch();
    } catch (err) {
      toastError(err, "Error al cancelar el turno");
      refetch();
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando...
      </div>
    );
  }

  const upcoming =
    appointments?.filter((a) => a.status !== "cancelado" && new Date(a.scheduledAt) > new Date()) ??
    [];
  const history =
    appointments?.filter(
      (a) => new Date(a.scheduledAt) <= new Date() || a.status === "cancelado",
    ) ?? [];

  return (
    <DashboardLayout title="Mi panel" description="Gestioná tus turnos y tu información">
      <div className="mb-8 flex items-end justify-between">
        <div />
        <BookAppointmentDialog onBooked={refetch} />
      </div>

      <section className="grid gap-6 md:grid-cols-3">
        <StatCard icon={Calendar} label="Próximos turnos" value={upcoming.length} />
        <StatCard icon={Clock} label="Historial" value={history.length} />
        <StatCard icon={User} label="Mi rol" value={roles[0] ?? "paciente"} />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-foreground">Próximos turnos</h2>
        <div className="mt-4 space-y-3">
          {upcoming.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-muted-foreground">
              No tenés turnos próximos. <span className="text-primary">¡Reservá uno!</span>
            </div>
          )}
          {upcoming.map((a) => (
            <ApptRow key={a.id} appt={a} onCancel={() => cancelAppt(a.id)} />
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-foreground">Historial</h2>
            <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? "Ocultar historial" : `Mostrar historial (${history.length})`}
            </Button>
          </div>
          {showHistory && (
            <div className="mt-4 space-y-3">
              {history.map((a) => (
                <ApptRow key={a.id} appt={a} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-10">
        <ProfileEditor />
      </section>
    </DashboardLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-5 w-5 text-teal" />
      </div>
      <div className="mt-3 font-display text-3xl text-foreground capitalize">{value}</div>
    </div>
  );
}

function ApptRow({ appt, onCancel }: { appt: any; onCancel?: () => void }) {
  const date = new Date(appt.scheduledAt);
  const docName = appt.doctor?.user
    ? `${appt.doctor.user.firstName} ${appt.doctor.user.lastName}`
    : (appt.doctor?.user?.name ?? "Profesional");
  const specialtyName = appt.doctor?.specialty?.name ?? appt.specialty?.name ?? "";
  const statusColors: Record<string, string> = {
    pendiente: "bg-accent/30 text-secondary",
    confirmado: "bg-teal/20 text-teal",
    cancelado: "bg-destructive/10 text-destructive",
    completado: "bg-muted text-muted-foreground",
    ausente: "bg-muted text-muted-foreground",
  };
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div>
          <div className="font-medium text-foreground">
            {docName}
            {specialtyName ? ` · ${specialtyName}` : ""}
          </div>
          <div className="text-sm text-muted-foreground">
            {date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} ·{" "}
            {date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusColors[appt.displayStatus ?? appt.status]}`}
        >
          {appt.displayStatus ?? appt.status}
        </span>
        {onCancel && (appt.status === "pendiente" || appt.status === "confirmado") && (
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}

function BookAppointmentDialog({ onBooked }: { onBooked: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "review">("form");
  const [specialtyId, setSpecialtyId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [saving, setSaving] = useState(false);

  const CLINIC_ADDRESS = "Av. Siempre Viva 1234, Piso 2 — CABA, Argentina";

  const { data: specialties } = useQuery({
    queryKey: ["specialties"],
    queryFn: () => getActiveSpecialties(),
  });

  const { data: doctors } = useQuery({
    queryKey: ["doctors", specialtyId],
    enabled: !!specialtyId,
    queryFn: () => getDoctorsBySpecialty({ data: { specialtyId } }),
  });

  const doctor = doctors?.find((d) => d.id === doctorId);
  const SLOT_MIN = doctor?.slotMinutes ?? 30;

  const { data: schedules } = useQuery({
    queryKey: ["schedules", doctorId],
    enabled: !!doctorId && !doctor?.directBooking,
    queryFn: () => getDoctorSchedule({ data: { doctorId } }),
  });

  const { data: dayAppts, isFetching: isFetchingDayAppts } = useQuery({
    queryKey: ["day-appts", doctorId, date],
    enabled: !!doctorId && !!date && !doctor?.directBooking,
    queryFn: () => getDayAppointments({ data: { doctorId, date } }),
  });

  const slots = (() => {
    // Return empty early if prerequisites missing or still loading
    if (!date || !schedules || !dayAppts) return [];

    // Parse selected date
    const [yr, mo, dy] = date.split("-").map(Number);
    const targetDate = new Date(yr, mo - 1, dy);

    // Build occupied ranges as Date pairs (ignore canceled)
    const occupied = (dayAppts ?? [])
      .filter((a: any) => a.scheduledAt && a.status !== "cancelado")
      .map((a: any) => {
        const apptDate = new Date(a.scheduledAt);
        const durMinutes = Number(a.durationMinutes ?? SLOT_MIN) || SLOT_MIN;
        const start = new Date(
          apptDate.getFullYear(),
          apptDate.getMonth(),
          apptDate.getDate(),
          apptDate.getHours(),
          apptDate.getMinutes(),
          0,
          0,
        );
        const end = new Date(start.getTime() + durMinutes * 60_000);
        return { start, end };
      });

    return generateSlots({
      date: targetDate,
      schedule: schedules ?? [],
      occupied,
      slotMinutes: SLOT_MIN,
      now: new Date(),
    });
  })();

  const submit = async () => {
    if (!specialtyId || !doctorId || !slot || !user) return;
    setSaving(true);
    try {
      await bookAppointment({
        data: {
          patientId: user.id,
          doctorId,
          specialtyId,
          scheduledAt: slot,
          durationMinutes: SLOT_MIN,
        },
      });
      toast.success("Turno solicitado");
      setOpen(false);
      setStep("form");
      setSpecialtyId("");
      setDoctorId("");
      setDate("");
      setSlot("");
      onBooked();
    } catch (e) {
      toastError(e, "Error al reservar el turno");
    }
    setSaving(false);
  };

  if (!open) {
    if (isSoftlocked()) {
      return (
        <p className="text-sm text-muted-foreground">
          <Clock className="mr-1.5 inline h-4 w-4 align-text-bottom" />
          El sistema abre a las 08:00. Volvé a intentar dentro del horario de atención.
        </p>
      );
    }
    return (
      <Button onClick={() => setOpen(true)} size="lg" className="shadow-elegant">
        <Plus className="mr-2 h-4 w-4" /> Solicitar turno
      </Button>
    );
  }

  const specialty = specialties?.find((s) => s.id === specialtyId);
  const slotDate = slot ? new Date(slot) : null;

  let availabilityContent: React.JSX.Element;
  if (!doctorId || !date) {
    availabilityContent = (
      <p className="text-sm text-muted-foreground mt-1">Elegí profesional y fecha</p>
    );
  } else if (isFetchingDayAppts) {
    availabilityContent = (
      <p className="text-sm text-muted-foreground mt-1">Cargando horarios...</p>
    );
  } else if (slots.length === 0) {
    availabilityContent = (
      <p className="text-sm text-muted-foreground mt-1">Sin horarios disponibles este día</p>
    );
  } else {
    const availableSlots = slots.filter((s) => s.available);
    availabilityContent = (
      <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2 max-h-48 overflow-y-auto">
        {availableSlots.length > 0 ? (
          availableSlots.map((s) => (
            <Button
              key={s.value}
              type="button"
              size="sm"
              variant={slot === s.value ? "default" : "outline"}
              onClick={() => setSlot(s.value)}
              className="text-xs sm:text-sm min-h-[44px]"
            >
              {s.label}
            </Button>
          ))
        ) : (
          <p className="col-span-4 text-sm text-muted-foreground">
            No hay horarios disponibles (todos ocupados)
          </p>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {step === "form" ? "Nuevo turno" : "Confirmá tu turno"}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Elegí especialidad, profesional y horario"
              : "Revisá los datos antes de finalizar la reserva"}
          </DialogDescription>
        </DialogHeader>
        {step === "form" ? (
          <div className="mt-5 space-y-4">
            <div>
              <Label>Especialidad</Label>
              <Select
                value={specialtyId}
                onValueChange={(v) => {
                  setSpecialtyId(v);
                  setDoctorId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegí una especialidad" />
                </SelectTrigger>
                <SelectContent>
                  {specialties?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Profesional</Label>
              <Select
                value={doctorId}
                onValueChange={(v) => {
                  setDoctorId(v);
                  setSlot("");
                }}
                disabled={!specialtyId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      specialtyId
                        ? doctors?.length
                          ? "Elegí profesional"
                          : "Sin profesionales aún"
                        : "Elegí especialidad primero"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {doctors?.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="py-3">
                      <div>
                        <div>
                          {d.user?.firstName} {d.user?.lastName}
                        </div>
                        {d.bio && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {d.bio}
                          </div>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {doctor?.insuranceCompanies && doctor.insuranceCompanies.length > 0 && (
              <div className="rounded-xl bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                  <Building2 className="h-3 w-3" /> Obras sociales aceptadas
                </div>
                <div className="flex flex-wrap gap-1">
                  {doctor.insuranceCompanies.map((ins: string) => (
                    <span
                      key={ins}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                    >
                      {ins}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {doctor?.directBooking ? (
              <div className="rounded-xl border border-teal/30 bg-teal/5 p-4 space-y-2">
                <p className="text-sm font-medium">
                  Este profesional coordina los turnos por WhatsApp.
                </p>
                <p className="text-sm text-muted-foreground">
                  Escribile directamente para coordinar tu turno
                  {specialty ? ` de ${specialty.name}` : ""}.
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Número: </span>
                  {formatArPhone(doctor.user?.phone ?? "")}
                </p>
                <Button asChild className="mt-2 w-full">
                  <a
                    href={toWaLink(
                      doctor.user?.phone ?? "",
                      `Hola, quisiera coordinar un turno${specialty ? ` de ${specialty.name}` : ""}.`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" /> Coordinar por WhatsApp
                  </a>
                </Button>
              </div>
            ) : (
              <>
                {schedules && schedules.length > 0 && (
                  <div>
                    <Label>Horarios de atención</Label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((name, i) => {
                        const active = schedules.some((s) => s.weekday === i);
                        return (
                          <span
                            key={i}
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              active
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-muted text-muted-foreground opacity-40"
                            }`}
                          >
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setSlot("");
                    }}
                    disabled={!doctorId}
                  />
                </div>
                <div>
                  <Label>Horario disponible</Label>
                  {availabilityContent}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-3 rounded-xl border border-border bg-surface p-4 text-sm">
            <SummaryRow label="Especialidad" value={specialty?.name ?? "—"} />
            <SummaryRow
              label="Profesional"
              value={doctor?.user ? `${doctor.user.firstName} ${doctor.user.lastName}` : "—"}
            />
            <SummaryRow
              label="Fecha"
              value={
                slotDate
                  ? slotDate.toLocaleDateString("es-AR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"
              }
            />
            <SummaryRow
              label="Hora"
              value={
                slotDate
                  ? `${slotDate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} hs (${SLOT_MIN} min)`
                  : "—"
              }
            />
            <SummaryRow label="Dirección" value={CLINIC_ADDRESS} />
          </div>
        )}
        <DialogFooter>
          {step === "form" ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {doctor?.directBooking ? "Cerrar" : "Cancelar"}
              </Button>
              {!doctor?.directBooking && (
                <Button
                  onClick={() => setStep("review")}
                  disabled={!specialtyId || !doctorId || !slot}
                >
                  Continuar
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("form")} disabled={saving}>
                Corregir
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? "Guardando..." : "Confirmar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground capitalize">{value}</span>
    </div>
  );
}
