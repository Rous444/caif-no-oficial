import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Shield,
  Users,
  Stethoscope,
  Image as ImageIcon,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, type AppRole } from "@/lib/auth";

import { DashboardLayout } from "@/components/layout/DashboardLayout";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administración ·CAIF" }] }),
  component: AdminPanel,
});

const quickLinks = [
  {
    title: "Especialidades",
    description: "Gestionar especialidades médicas",
    icon: Stethoscope,
    href: "/admin",
  },
  {
    title: "Médicos",
    description: "Administrar profesionales",
    icon: Users,
    href: "/admin",
  },
  {
    title: "Galería",
    description: "Imágenes del consultorio",
    icon: ImageIcon,
    href: "/admin",
  },
  {
    title: "Roles",
    description: "Permisos de usuarios",
    icon: Shield,
    href: "/admin",
  },
];

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
    <DashboardLayout
      title="Administración"
      description="Panel de administración del consultorio."
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-background p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10">
              <UserCog className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-xl">
                Bienvenido, {user.firstName}
              </h2>
              <p className="text-sm text-muted-foreground">
                Panel en construcción — las funcionalidades de gestión estarán disponibles próximamente.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.title}
              to={link.href}
              className="rounded-2xl border border-border bg-background p-5 transition-shadow hover:shadow-md"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
                <link.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-display text-base">{link.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
