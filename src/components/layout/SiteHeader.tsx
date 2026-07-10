import { Link, useRouter } from "@tanstack/react-router";
import {
  Menu,
  X,
  ChevronDown,
  CalendarDays,
  Shield,
  Stethoscope,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import favicon from "../../assets/Favicon.png";
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

export function SiteHeader() {
  const { user, signOut, hasRole } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <img src={favicon} alt="CAIF" className="h-8 w-8" />
          <div className="leading-tight">
            <div className="font-display text-lg text-foreground">CAIF</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Consultorio Médico
            </div>
          </div>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-1" aria-label="Abrir menú de accesos">
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
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => router.navigate({ to: "/login" })}>
                Iniciar sesión
              </Button>
              <Button onClick={() => router.navigate({ to: "/register" })}>Registrarse</Button>
            </>
          )}
        </div>

        <button
          className="md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-border bg-background md:hidden">
          <div className="space-y-1 px-4 py-3">
            <div className="flex flex-col gap-1 pt-2">
              {user ? (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      router.navigate({ to: "/dashboard" });
                      setOpen(false);
                    }}
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Mi panel
                  </Button>
                  {hasRole("medico") && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        router.navigate({ to: "/doctor" });
                        setOpen(false);
                      }}
                    >
                      <Stethoscope className="mr-2 h-4 w-4" /> Mi agenda
                    </Button>
                  )}
                  {hasRole("recepcionista") && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        router.navigate({ to: "/staff" });
                        setOpen(false);
                      }}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" /> Agenda general
                    </Button>
                  )}
                  {hasRole("admin") && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        router.navigate({ to: "/admin" });
                        setOpen(false);
                      }}
                    >
                      <Shield className="mr-2 h-4 w-4" /> Admin
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => signOut()}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Salir
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      router.navigate({ to: "/login" });
                      setOpen(false);
                    }}
                  >
                    Ingresar
                  </Button>
                  <Button
                    className="w-full"
                    onClick={() => {
                      router.navigate({ to: "/register" });
                      setOpen(false);
                    }}
                  >
                    Registrarse
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
