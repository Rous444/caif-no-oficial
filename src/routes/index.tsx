import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Hero, SpecialtiesGrid, GallerySection, ContactSection } from "@/components/home/HomeSections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediCare · Turnos online y atención médica integral" },
      { name: "description", content: "Reservá turnos online en 8+ especialidades médicas. Atención cercana, moderna y a tu medida." },
      { property: "og:title", content: "MediCare · Consultorio Médico" },
      { property: "og:description", content: "Reservá turnos online con nuestros profesionales en más de 8 especialidades." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <SpecialtiesGrid />
        <GallerySection />
        <ContactSection />
      </main>
      <SiteFooter />
    </div>
  );
}
