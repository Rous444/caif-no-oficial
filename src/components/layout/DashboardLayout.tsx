import { Link, useRouter } from "@tanstack/react-router";
import { Activity, ChevronDown, LayoutDashboard, Stethoscope, CalendarDays, Shield, LogOut, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  const { user, signOut, hasRole } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </span>
            <span className="font-display text-lg">CAIF</span>
          </Link>
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            )}
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <Home className="mr-2 h-4 w-4" /> Volver a Inicio
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1" aria-label="Abrir menú de accesos">
                  Mis accesos
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" aria-label="Accesos por rol">
                <DropdownMenuLabel>Paciente</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => router.navigate({ to: "/dashboard" })}>
                  <LayoutDashboard className="mr-2 h-4 w-4" aria-hidden="true" />
                  Mi panel
                </DropdownMenuItem>
                {hasRole("medico") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Médico</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => router.navigate({ to: "/doctor" })}>
                      <Stethoscope className="mr-2 h-4 w-4" aria-hidden="true" />
                      Mi agenda
                    </DropdownMenuItem>
                  </>
                )}
                {hasRole("recepcionista") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Staff</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => router.navigate({ to: "/staff" })}>
                      <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />
                      Agenda general
                    </DropdownMenuItem>
                  </>
                )}
                {hasRole("admin") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Administración</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => router.navigate({ to: "/admin" })}>
                      <Shield className="mr-2 h-4 w-4" aria-hidden="true" />
                      Admin
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Salir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
      >
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="font-display text-4xl text-foreground">{title}</h1>
            {description && <p className="mt-1 text-muted-foreground">{description}</p>}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}