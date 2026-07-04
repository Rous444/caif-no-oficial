import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function PasswordChangeGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (user?.mustChangePassword) {
      const currentPath = window.location.pathname;
      if (currentPath !== "/change-password") {
        router.navigate({ to: "/change-password" });
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (user?.mustChangePassword && window.location.pathname !== "/change-password") {
    return null;
  }

  return <>{children}</>;
}
