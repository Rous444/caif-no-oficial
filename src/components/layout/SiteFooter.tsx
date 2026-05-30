import { Activity, Mail, MapPin, Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal text-teal-foreground">
              <Activity className="h-5 w-5" />
            </span>
            <div className="font-display text-xl">MediCare</div>
          </div>
          <p className="mt-3 text-sm text-primary-foreground/70">
            Tu salud, nuestra prioridad. Atención médica integral con calidez humana.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider">Contacto</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-accent" />Av. Salud 1234, Ciudad</li>
            <li className="flex gap-2"><Phone className="h-4 w-4 shrink-0 text-accent" />+54 11 4000-0000</li>
            <li className="flex gap-2"><Mail className="h-4 w-4 shrink-0 text-accent" />contacto@medicare.com</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider">Horarios</h4>
          <ul className="space-y-1 text-sm text-primary-foreground/80">
            <li>Lun – Vie · 8:00 a 20:00</li>
            <li>Sábados · 9:00 a 13:00</li>
            <li>Domingos · Cerrado</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider">Enlaces</h4>
          <ul className="space-y-1 text-sm text-primary-foreground/80">
            <li><a href="/#especialidades" className="hover:text-accent">Especialidades</a></li>
            <li><a href="/#galeria" className="hover:text-accent">Galería</a></li>
            <li><a href="/login" className="hover:text-accent">Iniciar sesión</a></li>
            <li><a href="/register" className="hover:text-accent">Registrarse</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 py-4 text-center text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} MediCare. Todos los derechos reservados.
      </div>
    </footer>
  );
}