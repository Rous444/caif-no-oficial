import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarDays, ChevronLeft, ChevronRight, Clock, LogOut, Stethoscope, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/staff")({
  head: () => ({ meta: [{ title: "Agenda · MediCare" }] }),
  component: StaffPanel,
});

type Appt = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "pendiente" | "confirmado" | "cancelado" | "completado" | "ausente";
  notes: string | null;
  doctor_id: string;
  patient_id: string;
  doctors: { full_name: string } | null;
  specialties: { name: string } | null;
  profiles: { full_name: string | null; email: string | null; phone: string | null } | null;
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
  const day = (x.getDay() + 6) % 7; // monday=0
  return addDays(x, -day);
}
const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
const fmtTime = (d: Date) => d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

function StaffPanel() {
  const { user, loading, signOut, roles, hasRole } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<"day" | "week">("day");
  const [cursor, setCursor] = useState<Date>(startOfDay(new Date()));

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const isStaff = hasRole("medico") || hasRole("recepcionista") || hasRole("admin");

  // Doctor record for the logged-in medico (limits visible appts)
  const { data: myDoctor } = useQuery({
    queryKey: ["my-doctor", user?.id],
    enabled: !!user && hasRole("medico"),
    queryFn: async () => {
      const { data } = await supabase.from("doctors").select("id").eq("profile_id", user!.id).maybeSingle();
      return data;
    },
  });

  const range = useMemo(() => {
    if (view === "day") return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) };
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 7) };
  }, [view, cursor]);

  const { data: appts, refetch, isLoading } = useQuery({
    queryKey: ["staff-appts", range.from.toISOString(), range.to.toISOString(), myDoctor?.id, hasRole("medico")],
    enabled: !!user && isStaff,
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select(
          "id, scheduled_at, duration_minutes, status, notes, doctor_id, patient_id, doctors(full_name), specialties(name), profiles!appointments_patient_id_fkey(full_name, email, phone)"
        )
        .gte("scheduled_at", range.from.toISOString())
        .lt("scheduled_at", range.to.toISOString())
        .order("scheduled_at", { ascending: true });
      if (hasRole("medico") && myDoctor?.id) q = q.eq("doctor_id", myDoctor.id);
      const { data, error } = await q;
      if (error) throw error;
      // profiles join may fail if FK name differs — fallback fetch
      return (data ?? []) as unknown as Appt[];
    },
  });

  // Fallback: load patient profiles separately if join failed
  const { data: patientMap } = useQuery({
    queryKey: ["patient-profiles", appts?.map((a) => a.patient_id).join(",")],
    enabled: !!appts && appts.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(appts!.map((a) => a.patient_id)));
      const { data } = await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids);
      const map: Record<string, { full_name: string | null; email: string | null; phone: string | null }> = {};
      (data ?? []).forEach((p: any) => (map[p.id] = p));
      return map;
    },
  });

  const updateStatus = async (id: string, status: Appt["status"]) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Turno actualizado");
      refetch();
    }
  };

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando...</div>;
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
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </span>
            <span className="font-display text-lg">MediCare</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.email} · {roles.join(", ")}
            </span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-foreground">Agenda</h1>
            <p className="mt-1 text-muted-foreground">
              {hasRole("medico") && !hasRole("recepcionista") ? "Tus turnos" : "Todos los profesionales"}
            </p>
          </div>
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
                    6
                  ).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`}
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
          <DayView
            appts={appts ?? []}
            patientMap={patientMap ?? {}}
            onUpdateStatus={updateStatus}
            onChanged={refetch}
          />
        ) : (
          <WeekView
            from={startOfWeek(cursor)}
            appts={appts ?? []}
            patientMap={patientMap ?? {}}
            onPickDay={(d) => {
              setCursor(d);
              setView("day");
            }}
          />
        )}
      </main>
    </div>
  );
}

function DayView({
  appts,
  patientMap,
  onUpdateStatus,
  onChanged,
}: {
  appts: Appt[];
  patientMap: Record<string, { full_name: string | null; email: string | null; phone: string | null }>;
  onUpdateStatus: (id: string, status: Appt["status"]) => void;
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
        <ApptCard
          key={a.id}
          appt={a}
          patient={a.profiles ?? patientMap[a.patient_id] ?? null}
          onUpdateStatus={onUpdateStatus}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function WeekView({
  from,
  appts,
  patientMap,
  onPickDay,
}: {
  from: Date;
  appts: Appt[];
  patientMap: Record<string, { full_name: string | null; email: string | null; phone: string | null }>;
  onPickDay: (d: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const grouped = days.map((d) => {
    const next = addDays(d, 1);
    return {
      day: d,
      items: appts.filter((a) => {
        const t = new Date(a.scheduled_at);
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
                const p = a.profiles ?? patientMap[a.patient_id];
                return (
                  <div
                    key={a.id}
                    className={`rounded-md px-2 py-1 text-xs ${statusBg(a.status)}`}
                  >
                    <div className="font-medium">{fmtTime(new Date(a.scheduled_at))}</div>
                    <div className="truncate text-muted-foreground">
                      {p?.full_name || "Paciente"}
                    </div>
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

function statusBg(s: Appt["status"]) {
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
  patient,
  onUpdateStatus,
  onChanged,
}: {
  appt: Appt;
  patient: { full_name: string | null; email: string | null; phone: string | null } | null;
  onUpdateStatus: (id: string, status: Appt["status"]) => void;
  onChanged: () => void;
}) {
  const date = new Date(appt.scheduled_at);
  const [reschedOpen, setReschedOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-lg text-foreground">{fmtTime(date)} · {appt.duration_minutes} min</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="inline-flex items-center gap-1 text-foreground">
              <User className="h-3.5 w-3.5" /> {patient?.full_name || "Paciente"}
            </span>
            {patient?.phone && <span className="text-muted-foreground">· {patient.phone}</span>}
            {patient?.email && <span className="text-muted-foreground">· {patient.email}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Stethoscope className="h-3 w-3" /> {appt.doctors?.full_name}
            </span>
            <span>· {appt.specialties?.name}</span>
          </div>
          {appt.notes && <div className="mt-2 text-sm text-muted-foreground">“{appt.notes}”</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusBg(appt.status)}`}>
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
          <Button size="sm" variant="destructive" onClick={() => onUpdateStatus(appt.id, "cancelado")}>
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
  appt: Appt;
  onDone: () => void;
}) {
  const initial = new Date(appt.scheduled_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  const local = `${initial.getFullYear()}-${pad(initial.getMonth() + 1)}-${pad(initial.getDate())}T${pad(
    initial.getHours()
  )}:${pad(initial.getMinutes())}`;
  const [value, setValue] = useState(local);
  const [duration, setDuration] = useState(appt.duration_minutes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(local);
      setDuration(appt.duration_minutes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    if (!value) return;
    setSaving(true);
    const { error } = await supabase
      .from("appointments")
      .update({
        scheduled_at: new Date(value).toISOString(),
        duration_minutes: duration,
        status: "pendiente",
      })
      .eq("id", appt.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Turno reprogramado");
      onDone();
    }
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