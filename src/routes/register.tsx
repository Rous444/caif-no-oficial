import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { validatePasswordStrength } from "@/lib/password";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import FadeContent from "@/components/FadeContent";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Crear cuenta · MediCare" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validatePasswordStrength(password);
    if (!validation.valid) {
      toast.error(validation.error!);
      return;
    }

    setLoading(true);
    const { error } = await (authClient.signUp.email as any)({
      email,
      password,
      name: `${firstName} ${lastName}`,
      role: "paciente",
      firstName,
      middleName: middleName || undefined,
      lastName,
      phone,
      documentNumber,
    });
    setLoading(false);
    if (error) toast.error(error.message || "Error al crear la cuenta");
    else {
      toast.success("Cuenta creada exitosamente. Ya podés iniciar sesión.");
      navigate({ to: "/login" });
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-gradient-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
            <Activity className="h-5 w-5" />
          </span>
          <span className="font-display text-xl">MediCare</span>
        </Link>
        <div>
          <h2 className="font-display text-4xl">Tu salud digital</h2>
          <p className="mt-3 max-w-md text-primary-foreground/80">
            Reservá turnos 24/7 con los mejores profesionales.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} MediCare</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <FadeContent threshold={0} duration={800} className="w-full max-w-sm">
          <h1 className="font-display text-3xl text-foreground">Crear cuenta</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tardás menos de un minuto</p>

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="middleName">Segundo nombre</Label>
              <Input
                id="middleName"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="documentNumber">DNI</Label>
                <Input
                  id="documentNumber"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Mínimo 8 caracteres, mayúscula, minúscula y número
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creando..." : "Crear cuenta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </FadeContent>
      </div>
    </div>
  );
}
