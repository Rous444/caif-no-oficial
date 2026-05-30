import { Link, useRouter } from "@tanstack/react-router";
import { Activity, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const navLinks = [
  { to: "/", label: "Inicio" },
  { to: "/#especialidades", label: "Especialidades" },
  { to: "/#galeria", label: "Galería" },
  { to: "/#contacto", label: "Contacto" },
];

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
            <Activity className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-lg text-foreground">MediCare</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Consultorio Médico</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((l) => (
            <a key={l.to} href={l.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Button variant="ghost" onClick={() => router.navigate({ to: "/dashboard" })}>Mi panel</Button>
              <Button variant="outline" onClick={() => signOut()}>Salir</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => router.navigate({ to: "/login" })}>Iniciar sesión</Button>
              <Button onClick={() => router.navigate({ to: "/register" })}>Registrarse</Button>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menú">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="space-y-1 px-4 py-3">
            {navLinks.map((l) => (
              <a key={l.to} href={l.to} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">
                {l.label}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              {user ? (
                <>
                  <Button className="flex-1" onClick={() => router.navigate({ to: "/dashboard" })}>Mi panel</Button>
                  <Button variant="outline" className="flex-1" onClick={() => signOut()}>Salir</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => router.navigate({ to: "/login" })}>Ingresar</Button>
                  <Button className="flex-1" onClick={() => router.navigate({ to: "/register" })}>Registrarse</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}