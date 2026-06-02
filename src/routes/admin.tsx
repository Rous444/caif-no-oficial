import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  Activity,
  Image as ImageIcon,
  LogOut,
  Pencil,
  Plus,
  Shield,
  Stethoscope,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth, type AppRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administración · MediCare" }] }),
  component: AdminPanel,
});

function AdminPanel() {
  const { user, loading, signOut, hasRole } = useAuth();
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

  if (!hasRole("admin")) {
    return (
      <div className="min-h-screen bg-surface">
        <main className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="font-display text-3xl">Acceso restringido</h1>
          <p className="mt-2 text-muted-foreground">
            Solo los administradores pueden acceder a este panel.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/dashboard" })}>
            Volver
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </span>
            <span className="font-display text-lg">MediCare</span>
            <Badge variant="secondary" className="ml-2">
              <Shield className="mr-1 h-3 w-3" /> Admin
            </Badge>
          </Link>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl text-foreground">Administración</h1>
          <p className="mt-1 text-muted-foreground">
            Gestioná especialidades, profesionales, galería y permisos.
          </p>
        </div>

        <Tabs defaultValue="specialties" className="space-y-6">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="specialties" className="gap-2">
              <Stethoscope className="h-4 w-4" /> Especialidades
            </TabsTrigger>
            <TabsTrigger value="doctors" className="gap-2">
              <Users className="h-4 w-4" /> Médicos
            </TabsTrigger>
            <TabsTrigger value="gallery" className="gap-2">
              <ImageIcon className="h-4 w-4" /> Galería
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" /> Roles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="specialties"><SpecialtiesTab /></TabsContent>
          <TabsContent value="doctors"><DoctorsTab /></TabsContent>
          <TabsContent value="gallery"><GalleryTab /></TabsContent>
          <TabsContent value="roles"><RolesTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- Specialties ---------------- */

const specialtySchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  icon: z.string().trim().max(40).optional().or(z.literal("")),
  sort_order: z.coerce.number().int().min(0).max(999),
  is_active: z.boolean(),
});
type SpecialtyForm = z.infer<typeof specialtySchema>;

function SpecialtiesTab() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["admin-specialties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialties")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<any | null>(null);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (s: any) => {
    setEditing(s);
    setOpen(true);
  };

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("specialties").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Especialidad eliminada");
      refetch();
    }
    setToDelete(null);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Nueva especialidad
        </Button>
      </div>

      {isLoading ? (
        <SkeletonList />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((s) => (
            <div key={s.id} className="rounded-2xl border border-border bg-background p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-lg">{s.name}</div>
                  {s.icon && <div className="text-xs text-muted-foreground">{s.icon}</div>}
                </div>
                {!s.is_active && <Badge variant="outline">Inactiva</Badge>}
              </div>
              {s.description && (
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{s.description}</p>
              )}
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setToDelete(s)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {data?.length === 0 && <EmptyState text="No hay especialidades." />}
        </div>
      )}

      <SpecialtyDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSaved={() => {
          setOpen(false);
          refetch();
        }}
      />
      <ConfirmDelete
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={remove}
        label={toDelete?.name}
      />
    </div>
  );
}

function SpecialtyDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: any | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SpecialtyForm>({
    name: "",
    description: "",
    icon: "",
    sort_order: 0,
    is_active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name ?? "",
        description: initial?.description ?? "",
        icon: initial?.icon ?? "",
        sort_order: initial?.sort_order ?? 0,
        is_active: initial?.is_active ?? true,
      });
      setErrors({});
    }
  }, [open, initial]);

  const submit = async () => {
    const parsed = specialtySchema.safeParse(form);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (e[i.path[0] as string] = i.message));
      setErrors(e);
      return;
    }
    setSaving(true);
    const payload = {
      ...parsed.data,
      description: parsed.data.description || null,
      icon: parsed.data.icon || null,
    };
    const { error } = initial
      ? await supabase.from("specialties").update(payload).eq("id", initial.id)
      : await supabase.from("specialties").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(initial ? "Especialidad actualizada" : "Especialidad creada");
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar especialidad" : "Nueva especialidad"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Nombre" error={errors.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Descripción" error={errors.description}>
            <Textarea
              rows={3}
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ícono (nombre lucide)" error={errors.icon}>
              <Input
                placeholder="HeartPulse"
                value={form.icon ?? ""}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
              />
            </Field>
            <Field label="Orden" error={errors.sort_order}>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })
                }
              />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label>Activa</Label>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Doctors ---------------- */

const doctorSchema = z.object({
  full_name: z.string().trim().min(3, "Mínimo 3 caracteres").max(120),
  specialty_id: z.string().uuid("Elegí una especialidad"),
  license_number: z.string().trim().max(60).optional().or(z.literal("")),
  bio: z.string().trim().max(800).optional().or(z.literal("")),
  avatar_url: z
    .string()
    .trim()
    .url("URL inválida")
    .max(500)
    .optional()
    .or(z.literal("")),
  slot_minutes: z.coerce.number().int().min(10).max(180),
  is_active: z.boolean(),
});
type DoctorForm = z.infer<typeof doctorSchema>;

function DoctorsTab() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["admin-doctors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("*, specialties(name)")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });
  const { data: specialties } = useQuery({
    queryKey: ["admin-spec-options"],
    queryFn: async () =>
      (await supabase.from("specialties").select("id, name").order("name")).data ?? [],
  });

  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [schedFor, setSchedFor] = useState<any | null>(null);

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("doctors").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Profesional eliminado");
      refetch();
    }
    setToDelete(null);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo profesional
        </Button>
      </div>

      {isLoading ? (
        <SkeletonList />
      ) : (
        <div className="space-y-3">
          {data?.map((d: any) => (
            <div
              key={d.id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-primary text-primary-foreground">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-lg">{d.full_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {d.specialties?.name}
                    {d.license_number && ` · Mat. ${d.license_number}`} · {d.slot_minutes} min/turno
                  </div>
                </div>
                {!d.is_active && <Badge variant="outline">Inactivo</Badge>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setSchedFor(d)}>
                  Horarios
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setEditing(d); setOpen(true); }}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setToDelete(d)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {data?.length === 0 && <EmptyState text="No hay profesionales cargados." />}
        </div>
      )}

      <DoctorDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        specialties={specialties ?? []}
        onSaved={() => { setOpen(false); refetch(); }}
      />
      <ConfirmDelete
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={remove}
        label={toDelete?.full_name}
      />
      <SchedulesDialog
        doctor={schedFor}
        onOpenChange={(v) => !v && setSchedFor(null)}
      />
    </div>
  );
}

function DoctorDialog({
  open,
  onOpenChange,
  initial,
  specialties,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: any | null;
  specialties: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<DoctorForm>({
    full_name: "",
    specialty_id: "",
    license_number: "",
    bio: "",
    avatar_url: "",
    slot_minutes: 30,
    is_active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        full_name: initial?.full_name ?? "",
        specialty_id: initial?.specialty_id ?? "",
        license_number: initial?.license_number ?? "",
        bio: initial?.bio ?? "",
        avatar_url: initial?.avatar_url ?? "",
        slot_minutes: initial?.slot_minutes ?? 30,
        is_active: initial?.is_active ?? true,
      });
      setErrors({});
    }
  }, [open, initial]);

  const submit = async () => {
    const parsed = doctorSchema.safeParse(form);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (e[i.path[0] as string] = i.message));
      setErrors(e);
      return;
    }
    setSaving(true);
    const payload = {
      ...parsed.data,
      license_number: parsed.data.license_number || null,
      bio: parsed.data.bio || null,
      avatar_url: parsed.data.avatar_url || null,
    };
    const { error } = initial
      ? await supabase.from("doctors").update(payload).eq("id", initial.id)
      : await supabase.from("doctors").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(initial ? "Profesional actualizado" : "Profesional creado");
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar profesional" : "Nuevo profesional"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Nombre completo" error={errors.full_name}>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </Field>
          <Field label="Especialidad" error={errors.specialty_id}>
            <Select
              value={form.specialty_id}
              onValueChange={(v) => setForm({ ...form, specialty_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elegí una especialidad" />
              </SelectTrigger>
              <SelectContent>
                {specialties.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Matrícula" error={errors.license_number}>
              <Input
                value={form.license_number ?? ""}
                onChange={(e) => setForm({ ...form, license_number: e.target.value })}
              />
            </Field>
            <Field label="Duración del turno (min)" error={errors.slot_minutes}>
              <Input
                type="number"
                value={form.slot_minutes}
                onChange={(e) =>
                  setForm({ ...form, slot_minutes: parseInt(e.target.value) || 30 })
                }
              />
            </Field>
          </div>
          <Field label="Avatar URL" error={errors.avatar_url}>
            <Input
              placeholder="https://..."
              value={form.avatar_url ?? ""}
              onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
            />
          </Field>
          <Field label="Biografía" error={errors.bio}>
            <Textarea
              rows={3}
              value={form.bio ?? ""}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </Field>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label>Activo</Label>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Doctor Schedules ---------------- */

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const scheduleSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  })
  .refine((v) => v.start_time < v.end_time, {
    message: "El inicio debe ser anterior al fin",
    path: ["end_time"],
  });

function SchedulesDialog({
  doctor,
  onOpenChange,
}: {
  doctor: any | null;
  onOpenChange: (v: boolean) => void;
}) {
  const open = !!doctor;
  const { data, refetch } = useQuery({
    queryKey: ["schedules", doctor?.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_schedules")
        .select("*")
        .eq("doctor_id", doctor.id)
        .order("weekday")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("13:00");
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    const parsed = scheduleSchema.safeParse({ weekday, start_time: start, end_time: end });
    if (!parsed.success) {
      setErr(parsed.error.issues[0].message);
      return;
    }
    setErr(null);
    const { error } = await supabase.from("doctor_schedules").insert({
      doctor_id: doctor.id,
      ...parsed.data,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Horario agregado");
      refetch();
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("doctor_schedules").delete().eq("id", id);
    if (error) toast.error(error.message);
    else refetch();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Horarios — {doctor?.full_name}</DialogTitle>
          <DialogDescription>
            Definí los bloques de atención semanales.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <Field label="Día">
              <Select value={weekday} onValueChange={setWeekday}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Inicio">
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Fin">
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
            <Button onClick={add}>
              <Plus className="mr-1 h-4 w-4" /> Agregar
            </Button>
          </div>
          {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        </div>

        <div className="space-y-2">
          {data?.length === 0 && <EmptyState text="Sin horarios cargados." />}
          {data?.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-2"
            >
              <div className="text-sm">
                <span className="font-medium">{WEEKDAYS[s.weekday]}</span> ·{" "}
                {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Gallery ---------------- */

const gallerySchema = z.object({
  url: z.string().trim().url("URL inválida").max(500),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  sort_order: z.coerce.number().int().min(0).max(999),
  is_active: z.boolean(),
});
type GalleryForm = z.infer<typeof gallerySchema>;

function GalleryTab() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["admin-gallery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<any | null>(null);

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("gallery_images").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Imagen eliminada");
      refetch();
    }
    setToDelete(null);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nueva imagen
        </Button>
      </div>

      {isLoading ? (
        <SkeletonList />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((g) => (
            <div key={g.id} className="overflow-hidden rounded-2xl border border-border bg-background">
              <div className="aspect-video w-full overflow-hidden bg-muted">
                <img
                  src={g.url}
                  alt={g.title ?? "Imagen"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{g.title || "Sin título"}</div>
                  <div className="text-xs text-muted-foreground">Orden {g.sort_order} {!g.is_active && "· Inactiva"}</div>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" onClick={() => { setEditing(g); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setToDelete(g)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {data?.length === 0 && <EmptyState text="No hay imágenes en la galería." />}
        </div>
      )}

      <GalleryDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSaved={() => { setOpen(false); refetch(); }}
      />
      <ConfirmDelete
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={remove}
        label={toDelete?.title || "esta imagen"}
      />
    </div>
  );
}

function GalleryDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: any | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<GalleryForm>({
    url: "",
    title: "",
    sort_order: 0,
    is_active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        url: initial?.url ?? "",
        title: initial?.title ?? "",
        sort_order: initial?.sort_order ?? 0,
        is_active: initial?.is_active ?? true,
      });
      setErrors({});
    }
  }, [open, initial]);

  const submit = async () => {
    const parsed = gallerySchema.safeParse(form);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (e[i.path[0] as string] = i.message));
      setErrors(e);
      return;
    }
    setSaving(true);
    const payload = { ...parsed.data, title: parsed.data.title || null };
    const { error } = initial
      ? await supabase.from("gallery_images").update(payload).eq("id", initial.id)
      : await supabase.from("gallery_images").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(initial ? "Imagen actualizada" : "Imagen agregada");
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar imagen" : "Nueva imagen"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="URL de la imagen" error={errors.url}>
            <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </Field>
          <Field label="Título" error={errors.title}>
            <Input
              value={form.title ?? ""}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Orden" error={errors.sort_order}>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
            />
          </Field>
          {form.url && (
            <div className="overflow-hidden rounded-md border border-border">
              <img src={form.url} alt="preview" className="max-h-48 w-full object-cover" />
            </div>
          )}
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label>Activa</Label>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Roles ---------------- */

const ROLES: AppRole[] = ["paciente", "medico", "recepcionista", "admin"];

function RolesTab() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, full_name, email").order("full_name").limit(100);
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        q = q.or(`full_name.ilike.${term},email.ilike.${term}`);
      }
      const { data: profs, error } = await q;
      if (error) throw error;
      const ids = (profs ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data: roles } = await supabase.from("user_roles").select("*").in("user_id", ids);
      return (profs ?? []).map((p: any) => ({
        ...p,
        roles: (roles ?? []).filter((r: any) => r.user_id === p.id),
      }));
    },
  });

  const toggleRole = async (userId: string, role: AppRole, has: boolean) => {
    if (has) {
      if (role === "admin" && userId === user?.id) {
        toast.error("No podés quitarte tu propio rol de admin");
        return;
      }
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) toast.error(error.message);
      else refetch();
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) toast.error(error.message);
      else refetch();
    }
  };

  return (
    <div>
      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <SkeletonList />
      ) : (
        <div className="space-y-3">
          {data?.map((u: any) => (
            <div
              key={u.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-5 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="font-medium">{u.full_name || "Sin nombre"}</div>
                <div className="text-sm text-muted-foreground">{u.email}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => {
                  const has = u.roles.some((x: any) => x.role === r);
                  return (
                    <button
                      key={r}
                      onClick={() => toggleRole(u.id, r, has)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
                        has
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {data?.length === 0 && <EmptyState text="No se encontraron usuarios." />}
        </div>
      )}
    </div>
  );
}

/* ---------------- Shared helpers ---------------- */

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-border bg-background p-10 text-center text-muted-foreground">
      {text}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-muted/30" />
      ))}
    </div>
  );
}

function ConfirmDelete({
  open,
  onCancel,
  onConfirm,
  label,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  label?: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}