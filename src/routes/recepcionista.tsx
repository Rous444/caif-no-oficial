import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/recepcionista")({
  head: () => ({ meta: [{ title: "Recepción · CAIF" }] }),
  component: RecepcionistaRedirect,
});

function RecepcionistaRedirect() {
  const { user, loading, hasRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (!hasRole("recepcionista") && !hasRole("admin")) {
        navigate({ to: "/dashboard" });
      } else {
        navigate({ to: "/staff" });
      }
    }
  }, [loading, user, navigate, hasRole]);

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Redirigiendo...
    </div>
  );
}
