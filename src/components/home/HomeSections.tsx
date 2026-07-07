import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  Heart,
  Baby,
  Sparkles,
  Flower2,
  Bone,
  Brain,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import heroImg from "@/assets/clinic-hero.jpg";
import g1 from "@/assets/clinic-1.jpg";
import g2 from "@/assets/clinic-2.jpg";
import g3 from "@/assets/clinic-3.jpg";
import g4 from "@/assets/clinic-4.jpg";
import CountUp from "@/components/CountUp";
import SplitText from "@/components/SplitText";
import FadeContent from "@/components/FadeContent";

const iconMap: Record<string, typeof Stethoscope> = {
  Stethoscope,
  Heart,
  Baby,
  Sparkles,
  Flower2,
  Bone,
  Brain,
  Eye,
};

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24 lg:px-8">
        <div>
          <FadeContent threshold={0.2} duration={600}>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-secondary">
              <ShieldCheck className="h-3.5 w-3.5 text-teal" />
              Atención médica certificada
            </span>
          </FadeContent>
          <FadeContent threshold={0.2} duration={800} delay={150}>
            <SplitText
              text="Tu salud, en las mejores manos."
              tag="h1"
              className="mt-5 font-display text-5xl leading-[1.05] text-foreground md:text-6xl"
              splitType="words"
              delay={30}
              duration={0.6}
              from={{ opacity: 0, y: 30 }}
              to={{ opacity: 1, y: 0 }}
            />
          </FadeContent>
          <FadeContent threshold={0.2} duration={800} delay={300}>
            <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Reservá turnos online con nuestros profesionales en más de 15 especialidades. Atención
              cercana, moderna y a tu medida.
            </p>
          </FadeContent>
          <FadeContent threshold={0.2} duration={800} delay={450}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-secondary"
              >
                <Link to="/book">
                  <Calendar className="mr-2 h-5 w-5" />
                  Solicitar turno
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#especialidades">
                  
                  Ver especialidades
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </FadeContent>
          <FadeContent threshold={0.2} duration={0} delay={0}></FadeContent>
        </div>
        <FadeContent threshold={0.2} duration={1000} delay={300}>
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-primary opacity-20 blur-3xl" />
            <img
              src={heroImg}
              alt="Sala de espera moderna del consultorio CAIF"
              width={1536}
              height={1024}
              className="aspect-[4/3] w-full rounded-3xl object-cover"
            />
          </div>
        </FadeContent>
      </div>
    </section>
  );
}

export function SpecialtiesGrid() {
  const { data: specialties } = useQuery({
    queryKey: ["specialties-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialties")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <section id="especialidades" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <FadeContent threshold={0.1} duration={800}>
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <span className="text-xs font-medium uppercase tracking-widest text-teal">
              Especialidades
            </span>
            <h2 className="mt-2 font-display text-4xl text-foreground md:text-5xl">
              Atención integral
            </h2>
          </div>
          <p className="hidden max-w-md text-sm text-muted-foreground md:block">
            Cubrimos las principales áreas de la salud con profesionales matriculados y tecnología
            actualizada.
          </p>
        </div>
      </FadeContent>
      <div className="grid auto-rows-[140px] grid-cols-2 gap-4 md:grid-cols-4">
        {specialties?.map((s, i) => {
          const Icon = iconMap[s.icon ?? "Stethoscope"] ?? Stethoscope;
          const sizes = ["row-span-2", "", "", "col-span-2", "", "row-span-2", "", "col-span-2"];
          return (
            <FadeContent key={s.id} threshold={0.1} duration={600} delay={i * 80}>
              <div
                className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-shadow duration-300 hover:shadow-lg hover:-translate-y-0.5 ${sizes[i % 8]}`}
              >
                <div className="flex h-full flex-col justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl text-foreground">{s.name}</h3>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {s.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </FadeContent>
          );
        })}
      </div>
    </section>
  );
}

export function GallerySection() {
  const fallback = [
    { id: "1", url: g1, title: "Consultorio moderno" },
    { id: "2", url: g2, title: "Recepción" },
    { id: "3", url: g3, title: "Pasillos" },
    { id: "4", url: g4, title: "Pediatría" },
  ];
  const { data } = useQuery({
    queryKey: ["gallery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const images = data && data.length > 0 ? data : fallback;

  return (
    <section id="galeria" className="bg-surface py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeContent threshold={0.1} duration={800}>
          <div className="mb-10">
            <span className="text-xs font-medium uppercase tracking-widest text-teal">
              Conocenos
            </span>
            <h2 className="mt-2 font-display text-4xl text-foreground md:text-5xl">
              Nuestras instalaciones
            </h2>
          </div>
        </FadeContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {images.slice(0, 8).map((img, i) => (
            <FadeContent key={img.id} threshold={0.1} duration={600} delay={i * 60}>
              <div
                className={`group relative overflow-hidden rounded-2xl ${i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`}
              >
                <img
                  src={img.url}
                  alt={img.title ?? "Instalación del consultorio"}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
            </FadeContent>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ContactSection() {
  return (
    <section id="contacto" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <FadeContent threshold={0.1} duration={800}>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <span className="text-xs font-medium uppercase tracking-widest text-teal">
              Contacto
            </span>
            <h2 className="mt-2 font-display text-4xl text-foreground md:text-5xl">
              Estamos para vos
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Acercate a nuestro consultorio o comunicate por cualquier canal. Te esperamos.
            </p>
            <ul className="mt-8 space-y-4">
              <li className="flex gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-teal">
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-medium text-foreground">Dirección</div>
                  <div className="text-sm text-muted-foreground">Laprida 154, Cinco Saltos</div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-teal">
                  <Clock className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-medium text-foreground">Horarios</div>
                  <div className="text-sm text-muted-foreground">
                    Lun-Vie 9:00 a 14:00 y de 15:00 a 20:00
                  </div>
                </div>
              </li>
            </ul>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border">
            <iframe
              title="Ubicación del consultorio"
              src="https://www.google.com/maps?q=CAIF+Consultorios,-38.8267893,-68.0685319&output=embed"
              className="h-full min-h-[360px] w-full"
              loading="lazy"
            />
          </div>
        </div>
      </FadeContent>
    </section>
  );
}
