import { Clock } from "lucide-react";
import { isSoftlocked } from "@/lib/softlock";

export function SoftlockBanner() {
  if (!isSoftlocked()) return null;

  return (
    <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-center text-sm text-destructive">
      <Clock className="mr-1.5 inline h-4 w-4 align-text-bottom" />
      El sistema se encuentra fuera del horario de atención (08:00–21:00). No es posible agendar o
      modificar turnos.
    </div>
  );
}
