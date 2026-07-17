// Pure layout math for DayGrid — kept separate from rendering so it's testable
// without React/DOM.

export const GRID_START_MIN = 8 * 60; // 08:00
export const GRID_END_MIN = 21 * 60; // 21:00
export const GRID_TOTAL_MIN = GRID_END_MIN - GRID_START_MIN;

export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function clampToGrid(min: number): number {
  return Math.min(Math.max(min, GRID_START_MIN), GRID_END_MIN);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Position of an appointment block within the grid, in minutes from the grid's
// top (08:00). Clamped to the visible 08:00-21:00 range with a minimum visual
// height so very short appointments stay tappable.
export function blockPosition(
  start: Date,
  durationMinutes: number,
): { topMin: number; heightMin: number } {
  const startMin = minutesSinceMidnight(start);
  const endMin = startMin + Math.max(durationMinutes, 0);
  const clampedStart = clampToGrid(startMin);
  const clampedEnd = clampToGrid(endMin);
  return {
    topMin: clampedStart - GRID_START_MIN,
    heightMin: Math.max(clampedEnd - clampedStart, 12),
  };
}

// Offset of the "now" line from the grid's top, in minutes. Null when `now`
// isn't the day being displayed or falls outside business hours.
export function nowLineOffsetMin(now: Date, gridDate: Date): number | null {
  if (!isSameDay(now, gridDate)) return null;
  const min = minutesSinceMidnight(now);
  if (min < GRID_START_MIN || min > GRID_END_MIN) return null;
  return min - GRID_START_MIN;
}

export type Laned<T> = { item: T; lane: number; lanes: number };

// Assigns each item a lane (0-indexed column within its column) so that
// time-overlapping items render side by side instead of on top of each other.
// `lanes` is the total lane count for the connected cluster the item belongs to.
export function assignLanes<T>(
  items: T[],
  getStart: (t: T) => number,
  getEnd: (t: T) => number,
): Laned<T>[] {
  const sorted = [...items].sort((a, b) => getStart(a) - getStart(b));
  const result: Laned<T>[] = [];

  let clusterItems: { item: T; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const lanes = laneEnds.length || 1;
    for (const c of clusterItems) result.push({ item: c.item, lane: c.lane, lanes });
    clusterItems = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    const start = getStart(item);
    const end = getEnd(item);

    if (clusterItems.length > 0 && start >= clusterEnd) {
      flush();
    }

    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }

    clusterItems.push({ item, lane });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();

  return result;
}
