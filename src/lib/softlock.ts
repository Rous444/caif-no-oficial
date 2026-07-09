export function isSoftlocked(): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
  });
  const hour = parseInt(formatter.format(now).split(":").at(0)!, 10);
  return hour >= 21 || hour < 8;
}

export function throwIfSoftlocked() {
  if (isSoftlocked()) {
    throw new Error("El sistema no está disponible fuera del horario de atención (08:00–21:00)");
  }
}
