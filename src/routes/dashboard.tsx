import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Calendar, Clock, LogOut, Plus, Stethoscope, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Mi panel · MediCare" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, loading, signOut, roles } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const { data: appointments, refetch } = useQuery({
    queryKey: ["my-appointments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, duration_minutes, doctors(full_name), specialties(name)")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const cancelAppt = async (id: string) => {
    const { error } = await supabase.from("appointments").update({ status: "cancelado" }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Turno cancelado");
      refetch();
    }
  };

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando...</div>;
  }

  const upcoming = appointments?.filter((a) => a.status !== "cancelado" && new Date(a.scheduled_at) > new Date()) ?? [];
  const history = appointments?.filter((a) => new Date(a.scheduled_at) <= new Date() || a.status === "cancelado") ?? [];

  return (
    <div className="min-h-screen bg-surface">
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
              {user.email} · {roles.join(", ") || "paciente"}
            </span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="font-display text-4xl text-foreground">Mi panel</h1>
            <p className="mt-1 text-muted-foreground">Gestioná tus turnos y tu información</p>
          </div>
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
            <h2 className="font-display text-2xl text-foreground">Historial</h2>
            <div className="mt-4 space-y-3">
              {history.map((a) => (
                <ApptRow key={a.id} appt={a} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string | number }) {
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
  const date = new Date(appt.scheduled_at);
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
            {appt.doctors?.full_name ?? "Profesional"} · {appt.specialties?.name}
          </div>
          <div className="text-sm text-muted-foreground">
            {date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} ·{" "}
            {date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusColors[appt.status]}`}>
          {appt.status}
        </span>
        {onCancel && appt.status !== "cancelado" && (
          <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
        )}
      </div>
    </div>
  );
}

function BookAppointmentDialog({ onBooked }: { onBooked: () => void }) {
  const [open, setOpen] = useState(false);
  const [specialtyId, setSpecialtyId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: specialties } = useQuery({
    queryKey: ["specialties"],
    queryFn: async () => (await supabase.from("specialties").select("*").eq("is_active", true).order("name")).data ?? [],
  });
  const { data: doctors } = useQuery({
    queryKey: ["doctors", specialtyId],
    enabled: !!specialtyId,
    queryFn: async () =>
      (await supabase.from("doctors").select("*").eq("specialty_id", specialtyId).eq("is_active", true)).data ?? [],
  });

  const SLOT_MIN = 30;

  const { data: schedules } = useQuery({
    queryKey: ["schedules", doctorId],
    enabled: !!doctorId,
    queryFn: async () =>
      (await supabase.from("doctor_schedules").select("*").eq("doctor_id", doctorId)).data ?? [],
  });

  const { data: dayAppts } = useQuery({
    queryKey: ["day-appts", doctorId, date],
    enabled: !!doctorId && !!date,
    queryFn: async () => {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const { data } = await supabase
        .from("appointments")
        .select("scheduled_at, duration_minutes, status")
        .eq("doctor_id", doctorId)
        .neq("status", "cancelado")
        .gte("scheduled_at", start.toISOString())
        .lt("scheduled_at", end.toISOString());
      return data ?? [];
    },
  });

  const slots = (() => {
    if (!date || !schedules) return [] as { value: string; label: string }[];
    const d = new Date(`${date}T00:00:00`);
    const weekday = d.getDay();
    const blocks = schedules.filter((s: any) => s.weekday === weekday);
    if (blocks.length === 0) return [];
    const occupied = (dayAppts ?? []).map((a: any) => {
      const s = new Date(a.scheduled_at).getTime();
      return [s, s + a.duration_minutes * 60000] as [number, number];
    });
    const now = Date.now();
    const out: { value: string; label: string }[] = [];
    for (const b of blocks) {
      const [sh, sm] = String(b.start_time).split(":").map(Number);
      const [eh, em] = String(b.end_time).split(":").map(Number);
      const blockStart = new Date(d); blockStart.setHours(sh, sm, 0, 0);
      const blockEnd = new Date(d); blockEnd.setHours(eh, em, 0, 0);
      for (let t = blockStart.getTime(); t + SLOT_MIN * 60000 <= blockEnd.getTime(); t += SLOT_MIN * 60000) {
        if (t < now) continue;
        const end = t + SLOT_MIN * 60000;
        const clash = occupied.some(([os, oe]) => os < end && oe > t);
        if (clash) continue;
        const dt = new Date(t);
        out.push({
          value: dt.toISOString(),
          label: dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        });
      }
    }
    return out;
  })();

  const submit = async () => {
    if (!specialtyId || !doctorId || !slot) return;
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from("appointments").insert({
      patient_id: userRes.user!.id,
      specialty_id: specialtyId,
      doctor_id: doctorId,
      scheduled_at: slot,
      duration_minutes: SLOT_MIN,
      status: "pendiente",
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Turno solicitado");
      setOpen(false);
      setSpecialtyId(""); setDoctorId(""); setDate(""); setSlot("");
      onBooked();
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="lg" className="shadow-elegant">
        <Plus className="mr-2 h-4 w-4" /> Solicitar turno
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-primary/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-elegant">
        <h3 className="font-display text-2xl">Nuevo turno</h3>
        <p className="mt-1 text-sm text-muted-foreground">Elegí especialidad, profesional y horario</p>
        <div className="mt-5 space-y-4">
          <div>
            <Label>Especialidad</Label>
            <Select value={specialtyId} onValueChange={(v) => { setSpecialtyId(v); setDoctorId(""); }}>
              <SelectTrigger><SelectValue placeholder="Elegí una especialidad" /></SelectTrigger>
              <SelectContent>
                {specialties?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Profesional</Label>
            <Select value={doctorId} onValueChange={(v) => { setDoctorId(v); setSlot(""); }} disabled={!specialtyId}>
              <SelectTrigger><SelectValue placeholder={specialtyId ? (doctors?.length ? "Elegí profesional" : "Sin profesionales aún") : "Elegí especialidad primero"} /></SelectTrigger>
              <SelectContent>
                {doctors?.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha</Label>
            <Input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => { setDate(e.target.value); setSlot(""); }}
              disabled={!doctorId}
            />
          </div>
          <div>
            <Label>Horario disponible</Label>
            {!doctorId || !date ? (
              <p className="text-sm text-muted-foreground mt-1">Elegí profesional y fecha</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">Sin horarios disponibles este día</p>
            ) : (
              <div className="mt-2 grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {slots.map((s) => (
                  <Button
                    key={s.value}
                    type="button"
                    size="sm"
                    variant={slot === s.value ? "default" : "outline"}
                    onClick={() => setSlot(s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !specialtyId || !doctorId || !slot}>
            {saving ? "Guardando..." : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}