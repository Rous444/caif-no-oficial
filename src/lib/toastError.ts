import { toast } from "sonner";

// El código de AppError (src/lib/errors.ts) no cruza confiablemente el RPC de
// TanStack Start; lo único que llega siempre es `.message`, y el servidor ya
// lo arma como el texto final en castellano para mostrar. Por eso no hay un
// mapeo code -> mensaje acá: solo se usa el mensaje real si existe.
export function toastError(err: unknown, fallback: string) {
  toast.error(err instanceof Error ? err.message : fallback);
}
