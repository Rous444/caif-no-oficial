import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import { validatePasswordStrength } from "@/lib/password";
import { toast } from "sonner";
import { Activity, Lock } from "lucide-react";
import FadeContent from "@/components/FadeContent";

export const Route = createFileRoute("/change-password")({
  head: () => ({ meta: [{ title: "Cambiar contraseña · CAIF" }] }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      toast.error(validation.error!);
      return;
    }

    setLoading(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
      });
      if (error) {
        toast.error(error.message || "Error al cambiar la contraseña");
      } else {
        await (authClient.updateUser as any)({ mustChangePassword: false });
        await refreshUser();
        const role = user?.role;
        if (role === "admin") navigate({ to: "/admin" });
        else if (role === "medico" || role === "recepcionista") navigate({ to: "/staff" });
        else navigate({ to: "/dashboard" });
      }
    } catch {
      toast.error("Error al cambiar la contraseña");
    }
    setLoading(false);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-primary p-4">
      <FadeContent threshold={0} duration={800} className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-background p-8 shadow-elegant">
          <div className="mb-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10">
              <Lock className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="mt-4 font-display text-2xl text-foreground">Cambiar contraseña</h1>
            <p className="mt-2 text-sm text-destructive font-medium">
              Debes cambiar tu contraseña antes de continuar
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="current">Contraseña actual</Label>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="new">Nueva contraseña</Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Mínimo 8 caracteres, mayúscula, minúscula y número
              </p>
            </div>
            <div>
              <Label htmlFor="confirm">Confirmar nueva contraseña</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Cambiando..." : "Cambiar contraseña"}
            </Button>
          </form>
        </div>
      </FadeContent>
    </div>
  );
}
