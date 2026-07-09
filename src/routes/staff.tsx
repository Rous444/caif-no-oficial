import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Stethoscope,
  User,
  Building2,
  Plus,
  Search,
  UserPlus,
  Loader2,
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
import { isSoftlocked } from "@/lib/softlock";

import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  getStaffAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  bookAppointment,
  getDayAppointments,
} from "@/lib/api/appointments.functions";
import { searchPatients, createPatientByStaff } from "@/lib/api/admin-users.functions";
import { getAllDoctors } from "@/lib/api/admin-doctors.functions";
import { getDoctorSchedule } from "@/lib/api/doctor-schedule.functions";
import { getAllSpecialties } from "@/lib/api/specialties.functions";
import { ProfileEditor } from "@/components/ProfileEditor";
export const Route = createFileRoute("/staff")({
  head: () => ({ meta: [{ title: "Agenda · CAIF" }] }),
  component: StaffPanel,
});

type StaffAppt = {
  id: string;
  scheduledAt: Date;
  durationMinutes: number | null;
  status: "pendiente" | "confirmado" | "cancelado" | "completado" | "ausente";
  notes: string | null;
  doctor: {
    id: string;
    user: { id: string; firstName: string; lastName: string; name: string | null } | null;
    specialty: { name: string } | null;
    insuranceCompanies: string[] | null;
  } | null;
  specialty: { name: string } | null;
  patient: { firstName: string; lastName: string; email: string; phone: string } | null;
};

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

function StaffPanel() {
  const { user, loading, hasRole } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<"day" | "week">("day");
  const [cursor, setCursor] = useState<Date>(startOfDay(new Date()));

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const isStaff = hasRole("recepcionista") || hasRole("admin");

  const range = useMemo(() => {
    if (view === "day") return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) };
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 7) };
  }, [view, cursor]);

  const {
    data: appts,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["staff-appts", range.from.toISOString()],
    enabled: !!user && isStaff,
    queryFn: async () => {
      return (await getStaffAppointments({
        data: { date: range.from.toISOString().slice(0, 10) },
      })) as StaffAppt[];
    },
  });

  const updateStatus = async (id: string, status: StaffAppt["status"]) => {
    try {
      await updateAppointmentStatus({ data: { appointmentId: id, status } });
      toast.success("Turno actualizado");
      refetch();
    } catch {
      toast.error("Error al actualizar el turno");
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-surface">
        <main className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="font-display text-3xl">Acceso restringido</h1>
          <p className="mt-2 text-muted-foreground">
            Esta sección es para el personal del consultorio.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/dashboard" })}>
            Ir a mi panel
          </Button>
        </main>
      </div>
    );
  }

  const move = (n: number) => setCursor(addDays(cursor, view === "day" ? n : n * 7));

  return (
    <DashboardLayout
      title="Agenda"
      description={
        hasRole("medico") && !hasRole("recepcionista") ? "Tus turnos" : "Todos los profesionales"
      }
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <NewAppointmentDialog onCreated={refetch} />
        <Tabs value={view} onValueChange={(v) => setView(v as "day" | "week")}>
          <TabsList>
            <TabsTrigger value="day">Día</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-background p-4">
        <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Anterior">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col items-center">
          <div className="font-display text-xl capitalize">
            {view === "day"
              ? fmtDate(cursor)
              : `${startOfWeek(cursor).toLocaleDateString("es-AR", { day: "numeric", month: "short" })} – ${addDays(
                  startOfWeek(cursor),
                  6,
                ).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}`}
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
        <DayView appts={appts ?? []} onUpdateStatus={updateStatus} onChanged={refetch} />
      ) : (
        <WeekView
          from={startOfWeek(cursor)}
          appts={appts ?? []}
          onPickDay={(d) => {
            setCursor(d);
            setView("day");
          }}
        />
      )}
      <section className="mt-10">
        <ProfileEditor />
      </section>
    </DashboardLayout>
  );
}

function DayView({
  appts,
  onUpdateStatus,
  onChanged,
}: {
  appts: StaffAppt[];
  onUpdateStatus: (id: string, status: StaffAppt["status"]) => void;
  onChanged: () => void;
}) {
  if (appts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-muted-foreground">
        No hay turnos para este día.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {appts.map((a) => (
        <ApptCard key={a.id} appt={a} onUpdateStatus={onUpdateStatus} onChanged={onChanged} />
      ))}
    </div>
  );
}

function WeekView({
  from,
  appts,
  onPickDay,
}: {
  from: Date;
  appts: StaffAppt[];
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
            className={`flex min-h-[180px] flex-col rounded-2xl border bg-background p-3 text-left transition hover:border-primary ${
              isToday ? "border-primary" : "border-border"
            }`}
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

function statusBg(s: StaffAppt["status"]) {
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
}: {
  appt: StaffAppt;
  onUpdateStatus: (id: string, status: StaffAppt["status"]) => void;
  onChanged: () => void;
}) {
  const date = new Date(appt.scheduledAt);
  const [reschedOpen, setReschedOpen] = useState(false);
  const patientName = appt.patient
    ? `${appt.patient.firstName} ${appt.patient.lastName}`
    : "Paciente";
  const docName = appt.doctor?.user
    ? `${appt.doctor.user.firstName} ${appt.doctor.user.lastName}`
    : (appt.doctor?.user?.name ?? "Profesional");

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
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Stethoscope className="h-3 w-3" /> {docName}
            </span>
            <span>· {appt.doctor?.specialty?.name ?? appt.specialty?.name}</span>
            {appt.doctor?.insuranceCompanies && appt.doctor.insuranceCompanies.length > 0 && (
              <span>
                · <Building2 className="mr-0.5 inline h-3 w-3" />
                {appt.doctor.insuranceCompanies.join(", ")}
              </span>
            )}
          </div>
          {appt.notes && <div className="mt-2 text-sm text-muted-foreground">"{appt.notes}"</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusBg(appt.status)}`}
        >
          {appt.status}
        </span>
        {appt.status !== "confirmado" && appt.status !== "cancelado" && (
          <Button size="sm" onClick={() => onUpdateStatus(appt.id, "confirmado")}>
            Confirmar
          </Button>
        )}
        {appt.status !== "completado" && appt.status !== "cancelado" && (
          <Button size="sm" variant="outline" onClick={() => setReschedOpen(true)}>
            Reprogramar
          </Button>
        )}
        {appt.status === "confirmado" && (
          <Button size="sm" variant="outline" onClick={() => onUpdateStatus(appt.id, "completado")}>
            Completado
          </Button>
        )}
        {appt.status !== "cancelado" && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onUpdateStatus(appt.id, "cancelado")}
          >
            Cancelar
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
  appt: StaffAppt;
  onDone: () => void;
}) {
  const initial = new Date(appt.scheduledAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const local = `${initial.getFullYear()}-${pad(initial.getMonth() + 1)}-${pad(initial.getDate())}T${pad(
    initial.getHours(),
  )}:${pad(initial.getMinutes())}`;
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

function NewAppointmentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"patient" | "details">("patient");

  const [searchTerm, setSearchTerm] = useState("");
  const [patients, setPatients] = useState<
    {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      documentNumber: string | null;
    }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [doctors, setDoctors] = useState<
    {
      id: string;
      user: { firstName: string; lastName: string } | null;
      specialty: { name: string; id: string } | null;
      specialties: { specialty: { name: string; id: string } }[];
    }[]
  >([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<{ value: string; available: boolean }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    documentNumber: "",
  });

  const [specialties, setSpecialties] = useState<{ id: string; name: string }[]>([]);
  const [scheduleData, setScheduleData] = useState<{ weekday: number; startTime: string; endTime: string }[]>([]);

  const filteredDoctors = useMemo(() => {
    if (!selectedSpecialtyId) return [];
    return doctors.filter(
      (d) =>
        d.specialty?.id === selectedSpecialtyId ||
        d.specialties?.some((s) => s.specialty.id === selectedSpecialtyId),
    );
  }, [doctors, selectedSpecialtyId]);

  useEffect(() => {
    getAllSpecialties().then(setSpecialties).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDoctorId) {
      setScheduleData([]);
      return;
    }
    getDoctorSchedule({ data: { doctorId: selectedDoctorId } })
      .then(setScheduleData)
      .catch(() => setScheduleData([]));
  }, [selectedDoctorId]);

  useEffect(() => {
    if (!open) {
      setStep("patient");
      setSearchTerm("");
      setPatients([]);
      setSelectedPatient(null);
      setShowCreate(false);
      setSelectedDoctorId("");
      setSelectedSpecialtyId("");
      setSelectedDate("");
      setSlots([]);
      setSelectedSlot("");
      setCreateForm({ firstName: "", lastName: "", email: "", phone: "", documentNumber: "" });
    }
  }, [open]);

  useEffect(() => {
    getAllDoctors().then(setDoctors).catch(console.error);
  }, []);

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

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(searchTerm), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, doSearch]);

  useEffect(() => {
    if (!selectedDoctorId || !selectedDate) {
      setSlots([]);
      setSelectedSlot("");
      return;
    }
    const loadSlots = async () => {
      try {
        const schedule = await getDoctorSchedule({ data: { doctorId: selectedDoctorId } });
        const [yr, mo, dy] = selectedDate.split("-").map(Number);
        const date = new Date(yr, mo - 1, dy);
        const weekday = (date.getDay() + 6) % 7;
        const blocks = (schedule ?? []).filter((s: { weekday: number }) => s.weekday === weekday);
        if (blocks.length === 0) {
          setSlots([]);
          return;
        }

        const existing = await getDayAppointments({
          data: { doctorId: selectedDoctorId, date: selectedDate },
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
  }, [selectedDoctorId, selectedDate]);

  const handleCreatePatient = async () => {
    try {
      const patient = await createPatientByStaff({ data: createForm });
      setSelectedPatient(patient);
      setShowCreate(false);
      setSearchTerm(`${patient.firstName} ${patient.lastName}`);
      toast.success("Paciente creado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear paciente");
    }
  };

  const handleSubmit = async () => {
    if (
      !selectedPatient ||
      !selectedDoctorId ||
      !selectedSlot ||
      !selectedDate ||
      !selectedSpecialtyId
    )
      return;
    setSubmitting(true);
    try {
      const [sh, sm] = selectedSlot.split(":").map(Number);
      const [yr2, mo2, dy2] = selectedDate.split("-").map(Number);
      const scheduledAt = new Date(yr2, mo2 - 1, dy2);
      scheduledAt.setHours(sh, sm, 0, 0);
      await bookAppointment({
        data: {
          patientId: selectedPatient.id,
          doctorId: selectedDoctorId,
          specialtyId: selectedSpecialtyId,
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes: 30,
        },
      });
      toast.success("Turno creado");
      setOpen(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear el turno");
    }
    setSubmitting(false);
  };

  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={isSoftlocked()}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo turno
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
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
                placeholder="Buscar paciente por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {searching && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando...
              </div>
            )}

            {selectedPatient ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {selectedPatient.firstName} {selectedPatient.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedPatient.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedPatient(null);
                      setSearchTerm("");
                      setPatients([]);
                    }}
                  >
                    Cambiar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {patients.length > 0 && (
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {patients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full rounded-lg border border-border px-3 py-2 text-left transition hover:border-primary hover:bg-primary/5"
                        onClick={() => {
                          setSelectedPatient(p);
                          setSearchTerm(`${p.firstName} ${p.lastName}`);
                        }}
                      >
                        <div className="font-medium">
                          {p.firstName} {p.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.email}
                          {p.phone ? ` · ${p.phone}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchTerm.length >= 2 && !searching && patients.length === 0 && !showCreate && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">No se encontraron pacientes</p>
                    <Button variant="outline" className="mt-2" onClick={() => setShowCreate(true)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Crear nuevo paciente
                    </Button>
                  </div>
                )}

                {showCreate && (
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <Input
                      placeholder="Nombre"
                      value={createForm.firstName}
                      onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
                    />
                    <Input
                      placeholder="Apellido"
                      value={createForm.lastName}
                      onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    />
                    <Input
                      placeholder="Teléfono"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                    <Input
                      placeholder="DNI"
                      value={createForm.documentNumber}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, documentNumber: e.target.value }))
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowCreate(false)}
                      >
                        Cancelar
                      </Button>
                      <Button className="flex-1" onClick={handleCreatePatient}>
                        Guardar paciente
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!selectedPatient} onClick={() => setStep("details")}>
                Siguiente
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Paciente</Label>
              <p className="text-sm font-medium">
                {selectedPatient?.firstName} {selectedPatient?.lastName} · {selectedPatient?.email}
              </p>
            </div>

            <div>
              <Label>Especialidad</Label>
              <Select
                value={selectedSpecialtyId}
                onValueChange={(v) => {
                  setSelectedSpecialtyId(v);
                  setSelectedDoctorId("");
                  setSelectedSlot("");
                }}
              >
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

            {selectedSpecialtyId && (
              <div>
                <Label>Profesional</Label>
                <Select
                  value={selectedDoctorId}
                  onValueChange={(v) => {
                    setSelectedDoctorId(v);
                    setSelectedSlot("");
                  }}
                  disabled={filteredDoctors.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        filteredDoctors.length === 0
                          ? "Sin profesionales en esta especialidad"
                          : "Seleccionar médico"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDoctors.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="py-3">
                        <div>
                          <div>{d.user?.firstName} {d.user?.lastName}</div>
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
            )}

            {selectedDoctorId && scheduleData.length > 0 && (
              <div>
                <Label>Horarios de atención</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((name, i) => {
                    const active = scheduleData.some((s) => s.weekday === i);
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

            {selectedDoctorId && (
              <div>
                <Label>Fecha</Label>
                <Input
                  type="date"
                  min={today}
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlot("");
                  }}
                />
              </div>
            )}

            {slots.length > 0 && (
              <div>
                <Label>Horario disponible</Label>
                <div className="mt-1 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                  {slots.map((s) =>
                    s.available ? (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSelectedSlot(s.value)}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                          selectedSlot === s.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-primary"
                        }`}
                      >
                        {s.value}
                      </button>
                    ) : (
                      <div
                        key={s.value}
                        className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm text-destructive"
                      >
                        Ocupado
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {selectedDoctorId && selectedDate && slots.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay horarios disponibles para esta fecha.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("patient")}>
                Atrás
              </Button>
              <Button
                disabled={!selectedDoctorId || !selectedSlot || !selectedSpecialtyId || submitting}
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
