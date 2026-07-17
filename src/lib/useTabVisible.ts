import { useEffect, useState } from "react";

// Tracks whether the tab is currently visible, so polling (refetchInterval)
// can pause while the user is away instead of hammering the server.
export function useTabVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );

  useEffect(() => {
    const handler = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return visible;
}
