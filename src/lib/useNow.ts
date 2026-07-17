import { useEffect, useState } from "react";

// Ticking clock for UI that needs to redraw as time passes (the agenda's
// "now" line, "actualizado hace Xs" indicators). Deliberately coarse —
// nothing here needs sub-second precision.
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
