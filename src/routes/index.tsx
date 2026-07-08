import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import {
  Hero,
  SpecialtiesGrid,
  GallerySection,
  ContactSection,
} from "@/components/home/HomeSections";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CAIF · Turnos online y atención médica integral" },
      {
        name: "description",
        content:
          "Reservá turnos online en 8+ especialidades médicas. Atención cercana, moderna y a tu medida.",
      },
      { property: "og:title", content: "CAIF · Consultorio Médico" },
      {
        property: "og:description",
        content: "Reservá turnos online con nuestros profesionales en más de 8 especialidades.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, roles } = useAuth();
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <Hero user={user} roles={roles} />
        <SpecialtiesGrid />
        <GallerySection />
        <ContactSection />
      </main>
      <SiteFooter />
    </div>
  );
}
