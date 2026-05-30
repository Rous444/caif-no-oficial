import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión · MediCare" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else navigate({ to: "/dashboard" });
  };

  const onGoogle = async () => {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (res.error) toast.error("No se pudo iniciar sesión con Google");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-gradient-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><Activity className="h-5 w-5" /></span>
          <span className="font-display text-xl">MediCare</span>
        </Link>
        <div>
          <h2 className="font-display text-4xl">Cuidamos tu salud</h2>
          <p className="mt-3 max-w-md text-primary-foreground/80">Accedé a tus turnos, historial y notificaciones desde un solo lugar.</p>
        </div>
        <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} MediCare</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl text-foreground">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ingresá para gestionar tus turnos</p>

          <Button type="button" variant="outline" className="mt-6 w-full" onClick={onGoogle}>
            Continuar con Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> o con email <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿No tenés cuenta? <Link to="/register" className="font-medium text-primary hover:underline">Registrate</Link>
          </p>
        </div>
      </div>
    </div>
  );
}