import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import { resolveLoginIdentifier } from "@/lib/api/profile.functions";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import FadeContent from "@/components/FadeContent";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión · CAIF" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [emailOrDoc, setEmailOrDoc] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.mustChangePassword) {
      navigate({ to: "/change-password" });
    } else {
      const role = user.role;
      if (role === "admin") navigate({ to: "/admin" });
      else if (role === "medico") navigate({ to: "/doctor" });
      else if (role === "recepcionista") navigate({ to: "/staff" });
      else navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { email } = await resolveLoginIdentifier({ data: { identifier: emailOrDoc } });
      if (!email) {
        toast.error("No se encontró un usuario con ese email o DNI");
        setLoading(false);
        return;
      }
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        toast.error(error.message || "Credenciales inválidas");
        return;
      }
      await refreshUser();
    } catch {
      toast.error("Error al iniciar sesión");
    }
    setLoading(false);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-gradient-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
            <Activity className="h-5 w-5" />
          </span>
          <span className="font-display text-xl">CAIF</span>
        </Link>
        <div>
          <h2 className="font-display text-4xl">Cuidamos tu salud</h2>
          <p className="mt-3 max-w-md text-primary-foreground/80">
            Accedé a tus turnos, historial y notificaciones desde un solo lugar.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} CAIF</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <FadeContent threshold={0} duration={800} className="w-full max-w-sm">
          <h1 className="font-display text-3xl text-foreground">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ingresá para gestionar tus turnos</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="emailOrDoc">Email o DNI</Label>
              <Input
                id="emailOrDoc"
                type="text"
                value={emailOrDoc}
                onChange={(e) => setEmailOrDoc(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿No tenés cuenta?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Registrate
            </Link>
          </p>
        </FadeContent>
      </div>
    </div>
  );
}
