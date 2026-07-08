import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Users,
  Stethoscope,
  Image as ImageIcon,
  UserCog,
  Plus,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { toast } from "sonner";
import {
  getAllSpecialties,
  createSpecialty,
  updateSpecialty,
  deleteSpecialty,
} from "@/lib/api/specialties.functions";
import { getAllDoctors, updateDoctor, deleteDoctor } from "@/lib/api/admin-doctors.functions";
import {
  getUsers,
  createDoctorAccount,
  createRecepcionistaAccount,
  updateUserActive,
  deleteUser,
} from "@/lib/api/admin-users.functions";
import { GalleryTab } from "@/components/admin/GalleryTab";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administración · CAIF" }] }),
  component: AdminPanel,
});

function AdminPanel() {
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
    <DashboardLayout title="Administración" description="Panel de administración del consultorio.">
      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios" className="gap-2">
            <Users className="h-4 w-4" /> Usuarios
          </TabsTrigger>
          <TabsTrigger value="especialidades" className="gap-2">
            <Stethoscope className="h-4 w-4" /> Especialidades
          </TabsTrigger>
          <TabsTrigger value="medicos" className="gap-2">
            <UserCog className="h-4 w-4" /> Médicos
          </TabsTrigger>
          <TabsTrigger value="galeria" className="gap-2">
            <ImageIcon className="h-4 w-4" /> Galería
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <UsersTab />
        </TabsContent>
        <TabsContent value="especialidades">
          <SpecialtiesTab />
        </TabsContent>
        <TabsContent value="medicos">
          <DoctorsTab />
        </TabsContent>
        <TabsContent value="galeria">
          <GalleryTab />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: users } = useQuery({
    queryKey: ["admin-users", search, roleFilter],
    queryFn: () =>
      getUsers({
        data: {
          search: search || undefined,
          role: roleFilter && roleFilter !== "all" ? roleFilter : undefined,
        },
      }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateUserActive({ data: { userId, isActive } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Usuario actualizado");
    },
  });

  const removeUser = useMutation({
    mutationFn: (userId: string) => deleteUser({ data: { userId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Usuario eliminado");
    },
  });

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar usuarios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Todos los roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="paciente">Paciente</SelectItem>
              <SelectItem value="medico">Médico</SelectItem>
              <SelectItem value="recepcionista">Recepcionista</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Crear usuario
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="p-4 font-medium">Nombre</th>
              <th className="p-4 font-medium">Email</th>
              <th className="p-4 font-medium">Rol</th>
              <th className="p-4 font-medium">Estado</th>
              <th className="p-4 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="p-4">
                  {u.firstName} {u.lastName}
                </td>
                <td className="p-4 text-muted-foreground">{u.email}</td>
                <td className="p-4">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">
                    {u.role}
                  </span>
                </td>
                <td className="p-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${u.isActive ? "bg-teal/20 text-teal" : "bg-destructive/10 text-destructive"}`}
                  >
                    {u.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActive.mutate({ userId: u.id, isActive: !u.isActive })}
                    >
                      {u.isActive ? (
                        <ToggleLeft className="h-4 w-4" />
                      ) : (
                        <ToggleRight className="h-4 w-4" />
                      )}
                    </Button>
                    {u.role !== "admin" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeUser.mutate(u.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<"medico" | "recepcionista">("medico");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialtyIds, setSpecialtyIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: specialties } = useQuery({
    queryKey: ["specialties-all"],
    queryFn: () => getAllSpecialties(),
  });

  const toggleSpecialty = (id: string) => {
    setSpecialtyIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const reset = () => {
    setType("medico");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setSpecialtyIds([]);
  };

  const submit = async () => {
    setSaving(true);
    try {
      if (type === "medico") {
        const result = await createDoctorAccount({
          data: { firstName, lastName, email, phone, specialtyIds },
        });
        toast.success(`Médico creado. Contraseña temporal: ${result.temporaryPassword}`);
      } else {
        const result = await createRecepcionistaAccount({
          data: { firstName, lastName, email, phone },
        });
        toast.success(`Recepcionista creado. Contraseña temporal: ${result.temporaryPassword}`);
      }
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Error al crear usuario");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
          <DialogDescription>Creá una cuenta de médico o recepcionista</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo de cuenta</Label>
            <Select value={type} onValueChange={(v) => setType(v as "medico" | "recepcionista")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medico">Médico</SelectItem>
                <SelectItem value="recepcionista">Recepcionista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nombre</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <Label>Apellido</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          {type === "medico" && (
            <div>
              <Label>Especialidades</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {specialties?.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSpecialty(s.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                      specialtyIds.includes(s.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={
              saving ||
              !firstName ||
              !lastName ||
              !email ||
              !phone ||
              (type === "medico" && specialtyIds.length === 0)
            }
          >
            {saving ? "Creando..." : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SpecialtiesTab() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: specialties } = useQuery({
    queryKey: ["specialties-all"],
    queryFn: () => getAllSpecialties(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSpecialty({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specialties-all"] });
      toast.success("Especialidad eliminada");
    },
  });

  return (
    <div className="mt-6 space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setEditOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nueva especialidad
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {specialties?.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg">{s.name}</h3>
                {s.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                )}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${s.isActive ? "bg-teal/20 text-teal" : "bg-destructive/10 text-destructive"}`}
              >
                {s.isActive ? "Activo" : "Inactivo"}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(s);
                  setEditOpen(true);
                }}
              >
                Editar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => remove.mutate(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <SpecialtyDialog open={editOpen} onOpenChange={setEditOpen} specialty={editing} />
    </div>
  );
}

function SpecialtyDialog({
  open,
  onOpenChange,
  specialty,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  specialty: any;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(specialty?.name ?? "");
  const [description, setDescription] = useState(specialty?.description ?? "");
  const [icon, setIcon] = useState(specialty?.icon ?? "");
  const [sortOrder, setSortOrder] = useState(specialty?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(specialty?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(specialty?.name ?? "");
      setDescription(specialty?.description ?? "");
      setIcon(specialty?.icon ?? "");
      setSortOrder(specialty?.sortOrder ?? 0);
      setIsActive(specialty?.isActive ?? true);
    }
  }, [open, specialty]);

  const submit = async () => {
    setSaving(true);
    try {
      if (specialty) {
        await updateSpecialty({
          data: {
            id: specialty.id,
            name,
            description: description || undefined,
            icon: icon || undefined,
            sortOrder,
            isActive,
          },
        });
        toast.success("Especialidad actualizada");
      } else {
        await createSpecialty({
          data: { name, description: description || undefined, icon: icon || undefined, sortOrder },
        });
        toast.success("Especialidad creada");
      }
      queryClient.invalidateQueries({ queryKey: ["specialties-all"] });
      onOpenChange(false);
    } catch {
      toast.error("Error al guardar");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{specialty ? "Editar especialidad" : "Nueva especialidad"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Descripción</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Icono</Label>
              <Select value={icon || "Stethoscope"} onValueChange={setIcon}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar icono" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Stethoscope">Estetoscopio</SelectItem>
                  <SelectItem value="Heart">Corazón</SelectItem>
                  <SelectItem value="Baby">Bebé</SelectItem>
                  <SelectItem value="Sparkles">Destellos</SelectItem>
                  <SelectItem value="Flower2">Flor</SelectItem>
                  <SelectItem value="Bone">Hueso</SelectItem>
                  <SelectItem value="Brain">Cerebro</SelectItem>
                  <SelectItem value="Eye">Ojo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Orden</Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          {specialty && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="isActive">Activo</Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !name}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DoctorsTab() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: doctors } = useQuery({
    queryKey: ["admin-doctors"],
    queryFn: () => getAllDoctors(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDoctor({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
      toast.success("Médico eliminado");
    },
  });

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="p-4 font-medium">Nombre</th>
              <th className="p-4 font-medium">Especialidades</th>
              <th className="p-4 font-medium">Matrícula</th>
              <th className="p-4 font-medium">Obras Sociales</th>
              <th className="p-4 font-medium">Estado</th>
              <th className="p-4 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {doctors?.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-0">
                <td className="p-4">
                  {d.user?.firstName} {d.user?.lastName}
                </td>
                <td className="p-4 text-muted-foreground">
                  {d.specialties
                    ?.map((s: any) => s.specialty?.name)
                    .filter(Boolean)
                    .join(", ") ||
                    d.specialty?.name ||
                    "—"}
                </td>
                <td className="p-4 text-muted-foreground">{d.licenseNumber || "—"}</td>
                <td className="p-4">
                  {(() => {
                    const ins = d.insuranceCompanies;
                    return ins && ins.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {ins.slice(0, 3).map((i: string) => (
                          <span
                            key={i}
                            className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
                          >
                            {i}
                          </span>
                        ))}
                        {ins.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{ins.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      "—"
                    );
                  })()}
                </td>
                <td className="p-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${d.isActive ? "bg-teal/20 text-teal" : "bg-destructive/10 text-destructive"}`}
                  >
                    {d.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(d);
                        setEditOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => remove.mutate(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DoctorDialog open={editOpen} onOpenChange={setEditOpen} doctor={editing} />
    </div>
  );
}

function DoctorDialog({
  open,
  onOpenChange,
  doctor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doctor: any;
}) {
  const queryClient = useQueryClient();
  const [specialtyIds, setSpecialtyIds] = useState<string[]>([]);
  const [licenseNumber, setLicenseNumber] = useState(doctor?.licenseNumber ?? "");
  const [bio, setBio] = useState(doctor?.bio ?? "");
  const [slotMinutes, setSlotMinutes] = useState(doctor?.slotMinutes ?? 30);
  const [insuranceInput, setInsuranceInput] = useState("");
  const [insuranceCompanies, setInsuranceCompanies] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(doctor?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const { data: specialties } = useQuery({
    queryKey: ["specialties-all"],
    queryFn: () => getAllSpecialties(),
  });

  useEffect(() => {
    if (open && doctor) {
      const existing = doctor.specialties?.map((s: any) => s.specialtyId).filter(Boolean) ?? [];
      setSpecialtyIds(
        existing.length > 0 ? existing : doctor.specialtyId ? [doctor.specialtyId] : [],
      );
      setLicenseNumber(doctor.licenseNumber ?? "");
      setBio(doctor.bio ?? "");
      setSlotMinutes(doctor.slotMinutes ?? 30);
      setInsuranceCompanies(doctor.insuranceCompanies ?? []);
      setIsActive(doctor.isActive ?? true);
    }
  }, [open, doctor]);

  const toggleSpecialty = (id: string) => {
    setSpecialtyIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const addInsurance = () => {
    const v = insuranceInput.trim().toLowerCase();
    if (v && !insuranceCompanies.includes(v)) setInsuranceCompanies((p) => [...p, v]);
    setInsuranceInput("");
  };

  const removeInsurance = (i: number) =>
    setInsuranceCompanies((p) => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!doctor) return;
    setSaving(true);
    try {
      await updateDoctor({
        data: {
          id: doctor.id,
          specialtyIds,
          licenseNumber: licenseNumber || undefined,
          bio: bio || undefined,
          slotMinutes,
          insuranceCompanies,
          isActive,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
      toast.success("Médico actualizado");
      onOpenChange(false);
    } catch {
      toast.error("Error al actualizar");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar médico</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Especialidades</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {specialties?.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSpecialty(s.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                    specialtyIds.includes(s.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Matrícula</Label>
            <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
          </div>
          <div>
            <Label>Biografía</Label>
            <Input value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div>
            <Label>Duración turno (minutos)</Label>
            <Input
              type="number"
              min={15}
              max={120}
              step={5}
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(parseInt(e.target.value) || 30)}
            />
          </div>
          <div>
            <Label>Obras sociales</Label>
            <div className="mb-2 flex flex-wrap gap-1">
              {insuranceCompanies.map((ins, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                >
                  {ins}
                  <button
                    onClick={() => removeInsurance(i)}
                    className="text-primary/60 hover:text-primary"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={insuranceInput}
                onChange={(e) => setInsuranceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addInsurance();
                  }
                }}
                placeholder="Ej: ipross"
                className="max-w-40"
              />
              <Button size="sm" variant="outline" onClick={addInsurance} type="button">
                +
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="docIsActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="docIsActive">Activo</Label>
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