// Computed entirely in local process/browser time; assumes a fixed ARG timezone
// (no support for users in a different timezone).

export type ScheduleBlock = { weekday: number; startTime: string; endTime: string };
export type OccupiedRange = { start: Date; end: Date };
export type Slot = { value: string; label: string; available: boolean };

function overlaps(start: Date, end: Date, range: OccupiedRange): boolean {
  return start < range.end && end > range.start;
}

export function generateSlots(params: {
  date: Date;
  schedule: ScheduleBlock[];
  occupied: OccupiedRange[];
  slotMinutes: number;
  now?: Date;
}): Slot[] {
  const { date, schedule, occupied, slotMinutes, now } = params;

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const weekday = (date.getDay() + 6) % 7;

  const blocks = schedule.filter((b) => b.weekday === weekday);
  if (blocks.length === 0) return [];

  const isToday =
    !!now && now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
  const currentMinutes = now ? now.getHours() * 60 + now.getMinutes() : 0;

  const slotMs = slotMinutes * 60_000;
  const out: Slot[] = [];

  for (const block of blocks) {
    const [sh, sm] = block.startTime.split(":").map(Number);
    const [eh, em] = block.endTime.split(":").map(Number);
    let cursor = new Date(year, month, day, sh, sm, 0, 0).getTime();
    const blockEnd = new Date(year, month, day, eh, em, 0, 0).getTime();

    while (cursor + slotMs <= blockEnd) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor + slotMs);

      if (isToday && slotStart.getHours() * 60 + slotStart.getMinutes() <= currentMinutes) {
        cursor += slotMs;
        continue;
      }

      const isTaken = occupied.some((range) => overlaps(slotStart, slotEnd, range));

      out.push({
        value: slotStart.toISOString(),
        label: slotStart.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        available: !isTaken,
      });

      cursor += slotMs;
    }
  }

  return out;
}
