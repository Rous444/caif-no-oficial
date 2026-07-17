import { RefreshCw } from "lucide-react";
import { useNow } from "@/lib/useNow";

function relativeLabel(updatedAt: number, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - updatedAt) / 1000));
  if (seconds < 5) return "Actualizado ahora";
  if (seconds < 60) return `Actualizado hace ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `Actualizado hace ${minutes} min`;
}

export function FreshnessIndicator({
  updatedAt,
  isFetching,
  onRefresh,
}: {
  updatedAt: number;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const now = useNow(5_000);

  return (
    <button
      type="button"
      onClick={onRefresh}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
      title="Actualizar ahora"
    >
      <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
      {updatedAt > 0 ? relativeLabel(updatedAt, now) : "Actualizando..."}
    </button>
  );
}
