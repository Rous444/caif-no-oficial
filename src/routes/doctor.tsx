import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Stethoscope,
  User,
  Settings2,
  Check,
  X,
  Building2,
  Plus,
  FileText,
  Upload,
  Eye,
  Trash2,
  Search,
  History,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  getDoctorAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  bookAppointment,
  getDayAppointments,
} from "@/lib/api/appointments.functions";
import {
  getMySchedule,
  updateMySchedule,
  getDoctorIdByUserId,
  getMyDoctorProfile,
  updateMyInsurance,
  updateMyBio,
  updateMyWhatsappPreference,
} from "@/lib/api/doctor-schedule.functions";
import { searchPatients } from "@/lib/api/admin-users.functions";
import { getAllSpecialties } from "@/lib/api/specialties.functions";
import { ProfileEditor } from "@/components/ProfileEditor";
import { Switch } from "@/components/ui/switch";
import {
  uploadMedicalRecord,
  getMyPatientRecords,
  getRecordFile,
  deleteMedicalRecord,
} from "@/lib/api/medical-records.functions";

export const Route = createFileRoute("/doctor")({
  head: () => ({ meta: [{ title: "Mi Agenda · CAIF" }] }),
  component: DoctorPanel,
});

type DoctorAppt = {
  id: string;
  scheduledAt: Date;
  durationMinutes: number | null;
  status: "pendiente" | "confirmado" | "cancelado" | "completado" | "ausente";
  notes: string | null;
  specialty: { name: string } | null;
  patient: { id: string; firstName: string; lastName: string; email: string; phone: string } | null;
};

type ScheduleEntry = {
  weekday: number;
  startTime: string;
  endTime: string;
};

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7;
  return addDays(x, -day);
}
const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
const fmtTime = (d: Date) => d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

function DoctorWhatsAppToggle({ userId }: { userId: string }) {
  const { data: doctor, isLoading } = useQuery({
    queryKey: ["my-doctor-profile", userId],
    queryFn: () => getMyDoctorProfile({ data: { userId } }),
  });

  const queryClient = useQueryClient();

  const toggleWhatsApp = useMutation({
    mutationFn: (enabled: boolean) => updateMyWhatsappPreference({ data: { userId, enabled } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-doctor-profile", userId] });
      toast.success(
        doctor?.whatsappNotifications
          ? "Notificaciones de WhatsApp desactivadas"
          : "Notificaciones de WhatsApp activadas",
      );
    },
    onError: () => {
      toast.error("Error al actualizar preferencia");
    },
  });

  const whatsappEnabled = doctor?.whatsappNotifications ?? false;

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg">Notificaciones por WhatsApp</h3>
            <p className="text-sm text-muted-foreground">
              Recibí tu listado de turnos del día siguiente a las 21:00 ARG
            </p>
          </div>
        </div>
        <Switch
          checked={whatsappEnabled}
          onCheckedChange={(checked) => toggleWhatsApp.mutate(checked)}
          disabled={toggleWhatsApp.isPending || isLoading}
        />
      </div>
      {whatsappEnabled && (
        <p className="mt-3 text-xs text-teal">
          ✓ Activado — mañana recibirás tus turnos por WhatsApp
        </p>
      )}
    </div>
  );
}

function DoctorPanel() {
  const { user, loading, hasRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (!hasRole("medico")) {
    return (
      <div className="min-h-screen bg-surface">
        <main className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="font-display text-3xl">Acceso restringido</h1>
          <p className="mt-2 text-muted-foreground">
            Solo los médicos pueden acceder a este panel.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/dashboard" })}>
            Volver
          </Button>
        </main>
      </div>
    );
  }

  return (
    <DashboardLayout title="Mi Agenda" description="Gestioná tus turnos y horarios.">
      <Tabs defaultValue="agenda">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="agenda" className="gap-1 sm:gap-2">
              <CalendarDays className="h-4 w-4 shrink-0" />{" "}
              <span className="hidden sm:inline">Agenda</span>
            </TabsTrigger>
            <TabsTrigger value="horarios" className="gap-1 sm:gap-2">
              <Settings2 className="h-4 w-4 shrink-0" />{" "}
              <span className="hidden sm:inline">Horarios</span>
            </TabsTrigger>
            <TabsTrigger value="obras-sociales" className="gap-1 sm:gap-2">
              <Building2 className="h-4 w-4 shrink-0" />{" "}
              <span className="hidden sm:inline">Obras Sociales</span>
            </TabsTrigger>
            <TabsTrigger value="fichas" className="gap-1 sm:gap-2">
              <FileText className="h-4 w-4 shrink-0" />{" "}
              <span className="hidden sm:inline">Fichas Médicas</span>
            </TabsTrigger>
            <TabsTrigger value="descripcion" className="gap-1 sm:gap-2">
              <User className="h-4 w-4 shrink-0" />{" "}
              <span className="hidden sm:inline">Descripción</span>
            </TabsTrigger>
            <TabsTrigger value="perfil" className="gap-1 sm:gap-2">
              <User className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">Perfil</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="agenda">
          <AgendaTab userId={user.id} />
        </TabsContent>
        <TabsContent value="horarios">
          <ScheduleTab userId={user.id} />
        </TabsContent>
        <TabsContent value="obras-sociales">
          <InsuranceTab userId={user.id} />
        </TabsContent>
        <TabsContent value="fichas">
          <MedicalRecordsTab userId={user.id} />
        </TabsContent>
        <TabsContent value="descripcion">
          <DescriptionTab userId={user.id} />
        </TabsContent>
        <TabsContent value="perfil">
          <div className="mt-6 space-y-6">
            <ProfileEditor />
            <DoctorWhatsAppToggle userId={user!.id} />
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

function AgendaTab({ userId }: { userId: string }) {
  const [view, setView] = useState<"day" | "week">("day");
  const [cursor, setCursor] = useState<Date>(startOfDay(new Date()));
  const [turnoOpen, setTurnoOpen] = useState(false);

  const { data: doctorId } = useQuery({
    queryKey: ["my-doctor-id", userId],
    queryFn: () => getDoctorIdByUserId({ data: { userId } }),
  });

  const {
    data: appts,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["doctor-appts", userId],
    enabled: !!doctorId,
    queryFn: async () => {
      const all = await getDoctorAppointments({ data: { userId } });
      return all as DoctorAppt[];
    },
  });

  const range = useMemo(() => {
    if (view === "day") return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) };
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 7) };
  }, [view, cursor]);

  const filtered = useMemo(
    () =>
      (appts ?? []).filter((a) => {
        const t = new Date(a.scheduledAt);
        return t >= range.from && t < range.to;
      }),
    [appts, range],
  );

  const updateStatus = async (id: string, status: DoctorAppt["status"]) => {
    try {
      await updateAppointmentStatus({ data: { appointmentId: id, status } });
      toast.success("Turno actualizado");
      refetch();
    } catch {
      toast.error("Error al actualizar el turno");
    }
  };

  const move = (n: number) => setCursor(addDays(cursor, view === "day" ? n : n * 7));

  return (
    <div className="mt-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <Tabs value={view} onValueChange={(v) => setView(v as "day" | "week")}>
          <TabsList>
            <TabsTrigger value="day">Día</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
          </TabsList>
        </Tabs>
        {doctorId && (
          <>
            <Button onClick={() => setTurnoOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo turno
            </Button>
            <DoctorNewTurnoDialog
              doctorId={doctorId}
              open={turnoOpen}
              onOpenChange={setTurnoOpen}
              onCreated={refetch}
            />
          </>
        )}
      </div>

      <div className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-background p-4">
        <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Anterior">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col items-center">
          <div className="font-display text-xl capitalize">
            {view === "day"
              ? fmtDate(cursor)
              : `${startOfWeek(cursor).toLocaleDateString("es-AR", { day: "numeric", month: "short" })} – ${addDays(startOfWeek(cursor), 6).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`}
          </div>
          <button
            className="mt-1 text-xs text-primary hover:underline"
            onClick={() => setCursor(startOfDay(new Date()))}
          >
            Hoy
          </button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Siguiente">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-background p-10 text-center text-muted-foreground">
          Cargando agenda...
        </div>
      ) : view === "day" ? (
        <DayView appts={filtered} onUpdateStatus={updateStatus} onChanged={refetch} />
      ) : (
        <WeekView
          from={startOfWeek(cursor)}
          appts={filtered}
          onPickDay={(d) => {
            setCursor(d);
            setView("day");
          }}
        />
      )}
    </div>
  );
}

function DayView({
  appts,
  onUpdateStatus,
  onChanged,
}: {
  appts: DoctorAppt[];
  onUpdateStatus: (id: string, status: DoctorAppt["status"]) => void;
  onChanged: () => void;
}) {
  const [patientSearch, setPatientSearch] = useState("");
  const [historyPatient, setHistoryPatient] = useState<DoctorAppt["patient"] | null>(null);

  const filtered = patientSearch.trim()
    ? appts.filter((a) => {
        const name = a.patient ? `${a.patient.firstName} ${a.patient.lastName}`.toLowerCase() : "";
        return name.includes(patientSearch.toLowerCase());
      })
    : appts;

  const patientAppointments = historyPatient
    ? appts.filter((a) => a.patient?.id === historyPatient.id)
    : [];

  if (appts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-muted-foreground">
        No hay turnos para este día.
      </div>
    );
  }
  return (
    <>
      <div className="relative mb-4 max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar paciente..."
          value={patientSearch}
          onChange={(e) => setPatientSearch(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-muted-foreground">
          No se encontraron turnos para "{patientSearch}".
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <ApptCard
              key={a.id}
              appt={a}
              onUpdateStatus={onUpdateStatus}
              onChanged={onChanged}
              onShowHistory={(p) => setHistoryPatient(p)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={!!historyPatient}
        onOpenChange={(v) => {
          if (!v) setHistoryPatient(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Historial de {historyPatient?.firstName} {historyPatient?.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {patientAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Solo tiene este turno.</p>
            ) : (
              patientAppointments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{fmtDate(new Date(a.scheduledAt))}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtTime(new Date(a.scheduledAt))} · {a.durationMinutes ?? 30} min ·{" "}
                      {a.specialty?.name}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBg(a.status)}`}
                  >
                    {a.status}
                  </span>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryPatient(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function WeekView({
  from,
  appts,
  onPickDay,
}: {
  from: Date;
  appts: DoctorAppt[];
  onPickDay: (d: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const grouped = days.map((d) => {
    const next = addDays(d, 1);
    return {
      day: d,
      items: appts.filter((a) => {
        const t = new Date(a.scheduledAt);
        return t >= d && t < next;
      }),
    };
  });

  return (
    <div className="grid gap-3 md:grid-cols-7">
      {grouped.map(({ day, items }) => {
        const isToday = day.toDateString() === new Date().toDateString();
        return (
          <button
            key={day.toISOString()}
            onClick={() => onPickDay(day)}
            className={`flex min-h-[100px] sm:min-h-[180px] flex-col rounded-2xl border bg-background p-3 text-left transition hover:border-primary ${isToday ? "border-primary" : "border-border"}`}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {day.toLocaleDateString("es-AR", { weekday: "short" })}
              </div>
              <div className="font-display text-xl">{day.getDate()}</div>
            </div>
            <div className="space-y-1.5">
              {items.length === 0 && (
                <div className="text-xs text-muted-foreground">Sin turnos</div>
              )}
              {items.slice(0, 4).map((a) => {
                const patientName = a.patient
                  ? `${a.patient.firstName} ${a.patient.lastName}`
                  : "Paciente";
                return (
                  <div key={a.id} className={`rounded-md px-2 py-1 text-xs ${statusBg(a.status)}`}>
                    <div className="font-medium">{fmtTime(new Date(a.scheduledAt))}</div>
                    <div className="truncate text-muted-foreground">{patientName}</div>
                  </div>
                );
              })}
              {items.length > 4 && (
                <div className="text-xs text-primary">+{items.length - 4} más</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function statusBg(s: DoctorAppt["status"]) {
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

function ApptCard({
  appt,
  onUpdateStatus,
  onChanged,
  onShowHistory,
}: {
  appt: DoctorAppt;
  onUpdateStatus: (id: string, status: DoctorAppt["status"]) => void;
  onChanged: () => void;
  onShowHistory?: (patient: DoctorAppt["patient"]) => void;
}) {
  const date = new Date(appt.scheduledAt);
  const [reschedOpen, setReschedOpen] = useState(false);
  const patientName = appt.patient
    ? `${appt.patient.firstName} ${appt.patient.lastName}`
    : "Paciente";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-lg text-foreground">
            {fmtTime(date)} · {appt.durationMinutes ?? 30} min
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="inline-flex items-center gap-1 text-foreground">
              <User className="h-3.5 w-3.5" /> {patientName}
            </span>
            {appt.patient?.phone && (
              <span className="text-muted-foreground">· {appt.patient.phone}</span>
            )}
            {appt.patient?.email && (
              <span className="text-muted-foreground">· {appt.patient.email}</span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Stethoscope className="h-3 w-3" /> {appt.specialty?.name}
            </span>
          </div>
          {appt.notes && <div className="mt-2 text-sm text-muted-foreground">"{appt.notes}"</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {appt.patient && onShowHistory && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onShowHistory(appt.patient)}
            className="min-h-[44px]"
          >
            <History className="h-4 w-4" /> <span className="ml-1 hidden sm:inline">Historial</span>
          </Button>
        )}
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusBg(appt.status)}`}
        >
          {appt.status}
        </span>
        {appt.status !== "confirmado" &&
          appt.status !== "cancelado" &&
          appt.status !== "completado" && (
            <Button
              size="sm"
              onClick={() => onUpdateStatus(appt.id, "confirmado")}
              className="min-h-[44px]"
            >
              <Check className="h-4 w-4" /> <span className="ml-1 hidden sm:inline">Confirmar</span>
            </Button>
          )}
        {appt.status !== "completado" && appt.status !== "cancelado" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReschedOpen(true)}
            className="min-h-[44px]"
          >
            <span className="hidden sm:inline">Reprogramar</span>
            <span className="sm:hidden">Reprog.</span>
          </Button>
        )}
        {appt.status === "confirmado" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdateStatus(appt.id, "completado")}
            className="min-h-[44px]"
          >
            <span className="hidden sm:inline">Completado</span>
            <span className="sm:hidden">Compl.</span>
          </Button>
        )}
        {appt.status !== "cancelado" && appt.status !== "completado" && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onUpdateStatus(appt.id, "cancelado")}
            className="min-h-[44px]"
          >
            <X className="h-4 w-4" /> <span className="ml-1 hidden sm:inline">Cancelar</span>
          </Button>
        )}
      </div>

      <RescheduleDialog
        open={reschedOpen}
        onOpenChange={setReschedOpen}
        appt={appt}
        onDone={() => {
          setReschedOpen(false);
          onChanged();
        }}
      />
    </div>
  );
}

function RescheduleDialog({
  open,
  onOpenChange,
  appt,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appt: DoctorAppt;
  onDone: () => void;
}) {
  const initial = new Date(appt.scheduledAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const local = `${initial.getFullYear()}-${pad(initial.getMonth() + 1)}-${pad(initial.getDate())}T${pad(initial.getHours())}:${pad(initial.getMinutes())}`;
  const [value, setValue] = useState(local);
  const [duration, setDuration] = useState(appt.durationMinutes ?? 30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(local);
      setDuration(appt.durationMinutes ?? 30);
    }
  }, [open]);

  const submit = async () => {
    if (!value) return;
    setSaving(true);
    try {
      await rescheduleAppointment({
        data: {
          appointmentId: appt.id,
          scheduledAt: new Date(value).toISOString(),
          durationMinutes: duration,
        },
      });
      toast.success("Turno reprogramado");
      onDone();
    } catch {
      toast.error("Error al reprogramar el turno");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reprogramar turno</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nueva fecha y hora</Label>
            <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div>
            <Label>Duración (minutos)</Label>
            <Input
              type="number"
              min={10}
              step={5}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
            />
          </div>
          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
            El sistema bloquea horarios superpuestos con otros turnos del profesional.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando..." : "Confirmar cambio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InsuranceTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<string[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [loaded, setLoaded] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-doctor-profile", userId],
    queryFn: () => getMyDoctorProfile({ data: { userId } }),
  });

  useEffect(() => {
    if (profile?.insuranceCompanies && !loaded) {
      setItems(profile.insuranceCompanies);
      setLoaded(true);
    }
  }, [profile, loaded]);

  const addItem = () => {
    const v = inputVal.trim().toLowerCase();
    if (v && !items.includes(v)) setItems((p) => [...p, v]);
    setInputVal("");
  };

  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    try {
      await updateMyInsurance({ data: { userId, insuranceCompanies: items } });
      toast.success("Obras sociales guardadas");
    } catch {
      toast.error("Error al guardar");
    }
  };

  const specialtiesList =
    profile?.specialties
      ?.map((s: any) => s.specialty?.name)
      .filter(Boolean)
      .join(", ") || "—";

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-border bg-background p-6">
        <h3 className="font-display mb-1 text-lg">Obras Sociales</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {specialtiesList !== "—" && (
            <>
              Especialidades: <span className="text-foreground font-medium">{specialtiesList}</span>{" "}
              ·{" "}
            </>
          )}
          Gestioná las obras sociales con las que trabajás
        </p>
        {isLoading ? (
          <div className="text-muted-foreground">Cargando...</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {items.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {item}
                  <button
                    onClick={() => removeItem(i)}
                    className="ml-1 text-primary/60 hover:text-primary"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
                placeholder="Ej: ipross, osde, galeno..."
                className="max-w-xs"
              />
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={save}>Guardar</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ScheduleTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const { data: serverSchedules, isLoading } = useQuery({
    queryKey: ["my-schedule", userId],
    queryFn: () => getMySchedule({ data: { userId } }),
  });

  useEffect(() => {
    if (serverSchedules && !loaded) {
      setSchedules(
        serverSchedules.map((s) => ({
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      );
      setLoaded(true);
    }
  }, [serverSchedules, loaded]);

  const addSlot = (weekday: number) => {
    setSchedules((prev) => [...prev, { weekday, startTime: "08:00", endTime: "17:00" }]);
  };

  const removeSlot = (index: number) => {
    setSchedules((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof ScheduleEntry, value: string | number) => {
    setSchedules((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const save = async () => {
    try {
      await updateMySchedule({ data: { userId, schedules } });
      queryClient.invalidateQueries({ queryKey: ["my-schedule"] });
      toast.success("Horarios guardados");
    } catch {
      toast.error("Error al guardar horarios");
    }
  };

  const byDay = DAYS_FULL.map((_name, weekday) => ({
    weekday,
    label: DAYS[weekday],
    slots: schedules.filter((s) => s.weekday === weekday),
  }));

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-border bg-background p-6">
        <h3 className="font-display mb-4 text-lg">Configurar horarios semanales</h3>
        {isLoading ? (
          <div className="text-muted-foreground">Cargando horarios...</div>
        ) : (
          <div className="space-y-4">
            {byDay.map(({ weekday, label, slots }) => (
              <div key={weekday} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-medium">{label}</h4>
                  <Button size="sm" variant="outline" onClick={() => addSlot(weekday)}>
                    + Agregar
                  </Button>
                </div>
                {slots.length === 0 && <p className="text-xs text-muted-foreground">Sin horario</p>}
                {slots.map((slot, idx) => {
                  const globalIdx = schedules.findIndex(
                    (s, i) => s.weekday === weekday && schedules.indexOf(s) === i,
                  );
                  const actualIdx = schedules.findIndex(
                    (s, i) =>
                      s.weekday === weekday &&
                      schedules.slice(0, i).filter((x) => x.weekday === weekday).length === idx,
                  );
                  return (
                    <div key={idx} className="mb-2 flex items-center gap-3">
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateSlot(actualIdx, "startTime", e.target.value)}
                        className="w-24 sm:w-32"
                      />
                      <span className="text-muted-foreground">a</span>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateSlot(actualIdx, "endTime", e.target.value)}
                        className="w-24 sm:w-32"
                      />
                      <Button size="sm" variant="destructive" onClick={() => removeSlot(actualIdx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <div className="mt-6 flex justify-end">
          <Button onClick={save}>Guardar horarios</Button>
        </div>
      </div>
    </div>
  );
}

type PatientRecord = {
  id: string;
  patientId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  recordVersion: number;
  createdAt: Date | null;
  patient: {
    firstName: string;
    lastName: string;
    email: string;
    documentNumber: string | null;
  } | null;
};

function DescriptionTab({ userId }: { userId: string }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-doctor-profile-bio", userId],
    queryFn: () => getMyDoctorProfile({ data: { userId } }),
  });

  const [bio, setBio] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile && !loaded) {
      setBio(profile.bio ?? "");
      setLoaded(true);
    }
  }, [profile, loaded]);

  const save = async () => {
    setSaving(true);
    try {
      await updateMyBio({ data: { userId, bio } });
      toast.success("Descripción guardada");
    } catch {
      toast.error("Error al guardar la descripción");
    }
    setSaving(false);
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-border bg-background p-6">
        <h3 className="font-display mb-1 text-lg">Descripción profesional</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Esta descripción se muestra a los pacientes al seleccionar un profesional. Ej: "Realizo
          evaluaciones psicodiagnósticas con tests de personalidad (Rorschach, Zulliger)."
        </p>
        {isLoading ? (
          <div className="text-muted-foreground">Cargando...</div>
        ) : (
          <>
            <textarea
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[120px] resize-y"
              placeholder="Describí tu enfoque profesional, técnicas que utilizás, etc."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-muted-foreground">{bio.length}/500 caracteres</p>
            <div className="mt-4 flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? "Guardando..." : "Guardar descripción"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MedicalRecordsTab({ userId }: { userId: string }) {
  const { data: doctorId } = useQuery({
    queryKey: ["my-doctor-id-records", userId],
    queryFn: () => getDoctorIdByUserId({ data: { userId } }),
  });

  const { data: apptsData } = useQuery({
    queryKey: ["doctor-appts-patients", userId],
    enabled: !!doctorId,
    queryFn: async () => {
      const all = await getDoctorAppointments({ data: { userId } });
      return all as DoctorAppt[];
    },
  });

  const patientsWithAppts = useMemo(() => {
    if (!apptsData) return [];
    const seen = new Map<
      string,
      { id: string; firstName: string; lastName: string; email: string }
    >();
    for (const a of apptsData) {
      if (a.patient && !seen.has(a.patient.id)) {
        seen.set(a.patient.id, a.patient);
      }
    }
    return Array.from(seen.values());
  }, [apptsData]);

  const { data: records, refetch } = useQuery({
    queryKey: ["my-patient-records", doctorId],
    enabled: !!doctorId,
    queryFn: () => getMyPatientRecords({ data: { doctorId: doctorId! } }),
  });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForPatient, setUploadForPatient] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");

  const handleUpload = async (patientId: string) => {
    if (!file || !doctorId) return;
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      await uploadMedicalRecord({
        data: {
          doctorId,
          patientId,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileData: base64,
          fileSize: file.size,
        },
      });
      toast.success("Ficha médica subida");
      setUploadOpen(false);
      setFile(null);
      setUploadForPatient(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir la ficha");
    }
    setUploading(false);
  };

  const handleView = async (recordId: string) => {
    try {
      const { fileData, fileName, fileType } = await getRecordFile({
        data: { recordId },
      });
      const binary = atob(fileData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: fileType });
      const url = URL.createObjectURL(blob);
      if (fileType.startsWith("image/")) {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
      }
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Error al abrir la ficha");
    }
  };

  const handleDelete = async (recordId: string) => {
    try {
      await deleteMedicalRecord({ data: { recordId } });
      toast.success("Ficha eliminada");
      refetch();
    } catch {
      toast.error("Error al eliminar la ficha");
    }
  };

  const recordsByPatient = useMemo(() => {
    const map = new Map<string, (PatientRecord & { recordVersion: number })[]>();
    for (const r of records ?? []) {
      const pid = r.patientId;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(r as PatientRecord & { recordVersion: number });
    }
    for (const [, versions] of map) {
      versions.sort((a, b) => b.recordVersion - a.recordVersion);
    }
    return map;
  }, [records]);

  const filteredPatientIds = useMemo(() => {
    if (!search.trim()) return Array.from(recordsByPatient.keys());
    const term = search.toLowerCase();
    return Array.from(recordsByPatient.entries())
      .filter(([, versions]) => {
        const p = versions[0].patient;
        const name = `${p?.firstName} ${p?.lastName}`.toLowerCase();
        const dni = p?.documentNumber?.toLowerCase() ?? "";
        return name.includes(term) || dni.includes(term);
      })
      .map(([pid]) => pid);
  }, [recordsByPatient, search]);

  const fileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "PDF";
    if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext ?? "")) return "IMG";
    if (["doc", "docx"].includes(ext ?? "")) return "DOC";
    if (ext === "txt") return "TXT";
    return "FILE";
  };

  const openUpload = (patient?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }) => {
    setUploadForPatient(patient ?? null);
    setFile(null);
    setUploadOpen(true);
  };

  function PatientRecordCard({
    patientId,
    versions,
  }: {
    patientId: string;
    versions: (PatientRecord & { recordVersion: number })[];
  }) {
    const [showHistory, setShowHistory] = useState(false);
    const latest = versions[0];
    const prevVersions = versions.slice(1);
    const p = latest.patient;

    return (
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-primary text-primary-foreground text-sm font-bold">
              {p?.firstName?.[0]}
              {p?.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <div className="font-medium truncate">
                {p?.firstName} {p?.lastName}
              </div>
              <div className="text-xs text-muted-foreground">
                {p?.documentNumber ?? "—"} · {p?.email}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                openUpload({
                  id: patientId,
                  firstName: p?.firstName ?? "",
                  lastName: p?.lastName ?? "",
                  email: p?.email ?? "",
                })
              }
            >
              <Upload className="mr-1 h-4 w-4" /> Nueva versión
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowHistory(!showHistory)}
              disabled={prevVersions.length === 0}
            >
              <History className="mr-1 h-4 w-4" />
              {prevVersions.length > 0 ? `Historial (${versions.length})` : "Sin historial"}
            </Button>
          </div>
        </div>

        <div className="border-t border-border px-4 py-3 bg-muted/20">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {fileIcon(latest.fileName)}
              </span>
              <span className="truncate">{latest.fileName}</span>
              <span className="text-muted-foreground text-xs">
                v{latest.recordVersion} · {(latest.fileSize / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {latest.createdAt ? new Date(latest.createdAt).toLocaleDateString("es-AR") : ""}
              </span>
              <Button size="sm" variant="outline" onClick={() => handleView(latest.id)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(latest.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {showHistory && prevVersions.length > 0 && (
          <div className="border-t border-border">
            {prevVersions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0 bg-background/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                    {fileIcon(v.fileName)}
                  </span>
                  <span className="text-sm truncate">{v.fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    v{v.recordVersion} · {(v.fileSize / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {v.createdAt ? new Date(v.createdAt).toLocaleDateString("es-AR") : ""}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => handleView(v.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(v.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-border bg-background p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre o DNI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => openUpload()}>
            <Upload className="mr-2 h-4 w-4" /> Subir ficha
          </Button>
        </div>

        {recordsByPatient.size === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No hay fichas médicas aún.</p>
            <p className="text-xs mt-1">Subí la primera ficha usando el botón "Subir ficha".</p>
          </div>
        ) : filteredPatientIds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            <Search className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No se encontraron fichas para "{search}"</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPatientIds.map((patientId) => (
              <PatientRecordCard
                key={patientId}
                patientId={patientId}
                versions={recordsByPatient.get(patientId)!}
              />
            ))}
          </div>
        )}

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {uploadForPatient
                  ? `Nueva versión para ${uploadForPatient.firstName} ${uploadForPatient.lastName}`
                  : "Subir ficha médica"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {!uploadForPatient && (
                <div>
                  <Label>Paciente</Label>
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    value={uploadForPatient?.id ?? ""}
                    onChange={(e) => {
                      const p = patientsWithAppts.find((p) => p.id === e.target.value);
                      setUploadForPatient(p ?? null);
                    }}
                  >
                    <option value="">Seleccionar paciente</option>
                    {patientsWithAppts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} ({p.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <Label>Archivo (PDF, imagen, Word, TXT)</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {file && (
                <p className="text-xs text-muted-foreground">
                  {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => handleUpload(uploadForPatient!.id)}
                disabled={!file || !uploadForPatient || uploading}
              >
                {uploading ? "Subiendo..." : "Subir"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function DoctorNewTurnoDialog({
  doctorId,
  open,
  onOpenChange,
  onCreated,
}: {
  doctorId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<"patient" | "details">("patient");
  const [searchTerm, setSearchTerm] = useState("");
  const [patients, setPatients] = useState<
    {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      documentNumber: string | null;
    }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  } | null>(null);

  const [specialties, setSpecialties] = useState<{ id: string; name: string }[]>([]);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<{ value: string; available: boolean }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const doSearch = useCallback(async (term: string) => {
    if (term.length < 2) {
      setPatients([]);
      return;
    }
    setSearching(true);
    try {
      const res = await searchPatients({ data: { search: term } });
      setPatients(res);
    } catch {
      setPatients([]);
    }
    setSearching(false);
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(searchTerm), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, doSearch]);

  useEffect(() => {
    if (!open) {
      setStep("patient");
      setSearchTerm("");
      setPatients([]);
      setSelectedPatient(null);
      setSelectedSpecialtyId("");
      setSelectedDate("");
      setSlots([]);
      setSelectedSlot("");
    }
  }, [open]);

  useEffect(() => {
    getAllSpecialties()
      .then((s) => {
        setSpecialties(s);
        if (s.length === 1) setSelectedSpecialtyId(s[0].id);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      setSelectedSlot("");
      return;
    }
    const loadSlots = async () => {
      try {
        const { getDoctorSchedule } = await import("@/lib/api/doctor-schedule.functions");
        const schedule = await getDoctorSchedule({ data: { doctorId } });
        const [yr, mo, dy] = selectedDate.split("-").map(Number);
        const date = new Date(yr, mo - 1, dy);
        const weekday = (date.getDay() + 6) % 7;
        const blocks = (schedule ?? []).filter((s: { weekday: number }) => s.weekday === weekday);
        if (blocks.length === 0) {
          setSlots([]);
          return;
        }

        const existing = await getDayAppointments({
          data: { doctorId, date: selectedDate },
        });
        const occupiedRanges = (existing ?? [])
          .filter((a: any) => a.scheduledAt && a.status !== "cancelado")
          .map((a: any) => {
            const apptDate = new Date(a.scheduledAt);
            const startMin = apptDate.getHours() * 60 + apptDate.getMinutes();
            const dur = Number(a.durationMinutes ?? 30) || 30;
            return { start: startMin, end: startMin + dur };
          });

        const generated: { value: string; available: boolean }[] = [];
        for (const b of blocks) {
          const [sh, sm] = String(b.startTime).split(":").map(Number);
          const [eh, em] = String(b.endTime).split(":").map(Number);
          const blockStartMin = sh * 60 + sm;
          const blockEndMin = eh * 60 + em;
          for (let m = blockStartMin; m + 30 <= blockEndMin; m += 30) {
            const slotEnd = m + 30;
            const isTaken = occupiedRanges.some((r) => m < r.end && slotEnd > r.start);
            const hh = String(Math.floor(m / 60)).padStart(2, "0");
            const mm = String(m % 60).padStart(2, "0");
            generated.push({ value: `${hh}:${mm}`, available: !isTaken });
          }
        }
        setSlots(generated);
      } catch {
        setSlots([]);
      }
    };
    loadSlots();
  }, [doctorId, selectedDate]);

  const handleSubmit = async () => {
    if (!selectedPatient || !selectedSlot || !selectedDate || !selectedSpecialtyId) return;
    setSubmitting(true);
    try {
      const [sh, sm] = selectedSlot.split(":").map(Number);
      const [yr, mo, dy] = selectedDate.split("-").map(Number);
      const scheduledAt = new Date(yr, mo - 1, dy);
      scheduledAt.setHours(sh, sm, 0, 0);
      await bookAppointment({
        data: {
          patientId: selectedPatient.id,
          doctorId,
          specialtyId: selectedSpecialtyId,
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes: 30,
        },
      });
      toast.success("Turno creado");
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear el turno");
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "patient" ? "Seleccionar paciente" : "Detalles del turno"}
          </DialogTitle>
        </DialogHeader>

        {step === "patient" ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar paciente por nombre, email o DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            {searching && <p className="text-center text-sm text-muted-foreground">Buscando...</p>}

            {selectedPatient && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedPatient.email}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedPatient(null);
                    setSearchTerm("");
                  }}
                >
                  Cambiar
                </Button>
              </div>
            )}

            {!selectedPatient &&
              patients.length > 0 &&
              patients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSelectedPatient({
                      id: p.id,
                      firstName: p.firstName,
                      lastName: p.lastName,
                      email: p.email,
                      phone: p.phone,
                    });
                    setPatients([]);
                    setSearchTerm("");
                  }}
                >
                  <p className="text-sm font-medium">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </button>
              ))}

            {!selectedPatient && searchTerm.length >= 2 && !searching && patients.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                No se encontraron pacientes con ese criterio.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button disabled={!selectedPatient} onClick={() => setStep("details")}>
                Siguiente
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedPatient && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{selectedPatient.email}</p>
              </div>
            )}

            <div>
              <Label>Especialidad</Label>
              <Select value={selectedSpecialtyId} onValueChange={setSelectedSpecialtyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar especialidad" />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSlot("");
                }}
              />
            </div>

            {selectedDate && slots.length > 0 && (
              <div>
                <Label>Horario</Label>
                <div className="mt-1 grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {slots.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      disabled={!s.available}
                      className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                        selectedSlot === s.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : s.available
                            ? "border-border hover:border-primary hover:bg-primary/5"
                            : "border-border cursor-not-allowed text-muted-foreground/40 line-through"
                      }`}
                      onClick={() => setSelectedSlot(s.value)}
                    >
                      {s.value}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedDate && slots.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay horarios disponibles para esta fecha.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("patient")}>
                Atrás
              </Button>
              <Button
                disabled={!selectedSpecialtyId || !selectedSlot || submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Creando..." : "Confirmar turno"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
