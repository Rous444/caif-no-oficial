import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { updateProfile } from "@/lib/api/profile.functions";
import { toast } from "sonner";
import { User, Save } from "lucide-react";

export function ProfileEditor() {
  const { user, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  if (!user) return null;

  const markChanged = () => {
    if (!changed) setChanged(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
        },
      });
      await refreshUser();
      setChanged(false);
      toast.success("Perfil actualizado");
    } catch (e: any) {
      toast.error(e?.message || "Error al actualizar perfil");
    }
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-lg">Mi Perfil</h3>
          <p className="text-sm text-muted-foreground">Actualizá tus datos personales</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Nombre</Label>
          <Input
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              markChanged();
            }}
          />
        </div>
        <div>
          <Label>Apellido</Label>
          <Input
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              markChanged();
            }}
          />
        </div>
        <div>
          <Label>Teléfono</Label>
          <Input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              markChanged();
            }}
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              markChanged();
            }}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving || !changed}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
