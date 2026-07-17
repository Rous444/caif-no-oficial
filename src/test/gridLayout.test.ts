import { describe, expect, it } from "vitest";
import {
  GRID_END_MIN,
  GRID_START_MIN,
  assignLanes,
  blockPosition,
  nowLineOffsetMin,
} from "@/components/agenda/gridLayout";

describe("blockPosition", () => {
  it("positions a mid-day appointment relative to the 08:00 grid start", () => {
    const start = new Date(2026, 6, 15, 9, 30);
    const { topMin, heightMin } = blockPosition(start, 30);
    expect(topMin).toBe(90); // 09:30 - 08:00
    expect(heightMin).toBe(30);
  });

  it("clamps a block that starts before the grid window", () => {
    const start = new Date(2026, 6, 15, 7, 0);
    const { topMin, heightMin } = blockPosition(start, 90); // ends 08:30
    expect(topMin).toBe(0);
    expect(heightMin).toBe(30);
  });

  it("clamps a block that ends after the grid window", () => {
    const start = new Date(2026, 6, 15, 20, 45);
    const { topMin, heightMin } = blockPosition(start, 60); // ends 21:45
    expect(topMin).toBe(GRID_END_MIN - GRID_START_MIN - 15);
    expect(heightMin).toBe(15);
  });

  it("enforces a minimum visual height for very short appointments", () => {
    const start = new Date(2026, 6, 15, 10, 0);
    const { heightMin } = blockPosition(start, 5);
    expect(heightMin).toBe(12);
  });
});

describe("nowLineOffsetMin", () => {
  const gridDate = new Date(2026, 6, 15);

  it("returns the offset when now is the same day and within business hours", () => {
    const now = new Date(2026, 6, 15, 10, 15);
    expect(nowLineOffsetMin(now, gridDate)).toBe(10 * 60 + 15 - GRID_START_MIN);
  });

  it("returns null when now is a different day", () => {
    const now = new Date(2026, 6, 16, 10, 15);
    expect(nowLineOffsetMin(now, gridDate)).toBeNull();
  });

  it("returns null when now is outside business hours", () => {
    const now = new Date(2026, 6, 15, 22, 0);
    expect(nowLineOffsetMin(now, gridDate)).toBeNull();
  });
});

type Item = { id: string; start: number; end: number };
const item = (id: string, start: number, end: number): Item => ({ id, start, end });

describe("assignLanes", () => {
  const getStart = (i: Item) => i.start;
  const getEnd = (i: Item) => i.end;

  it("gives every item lane 0 when nothing overlaps", () => {
    const items = [item("a", 0, 30), item("b", 30, 60), item("c", 60, 90)];
    const laned = assignLanes(items, getStart, getEnd);
    expect(laned.every((l) => l.lane === 0 && l.lanes === 1)).toBe(true);
  });

  it("splits two overlapping items into separate lanes", () => {
    const items = [item("a", 0, 60), item("b", 30, 90)];
    const laned = assignLanes(items, getStart, getEnd);
    const a = laned.find((l) => l.item.id === "a")!;
    const b = laned.find((l) => l.item.id === "b")!;
    expect(a.lane).toBe(0);
    expect(b.lane).toBe(1);
    expect(a.lanes).toBe(2);
    expect(b.lanes).toBe(2);
  });

  it("reuses a freed lane once its item ends", () => {
    const items = [item("a", 0, 30), item("b", 0, 60), item("c", 30, 90)];
    const laned = assignLanes(items, getStart, getEnd);
    const a = laned.find((l) => l.item.id === "a")!;
    const b = laned.find((l) => l.item.id === "b")!;
    const c = laned.find((l) => l.item.id === "c")!;
    expect(a.lane).toBe(0);
    expect(b.lane).toBe(1);
    expect(c.lane).toBe(0); // a already ended by the time c starts
    expect(a.lanes).toBe(2);
  });

  it("keeps unrelated clusters independent", () => {
    const items = [item("a", 0, 30), item("b", 10, 40), item("c", 100, 130)];
    const laned = assignLanes(items, getStart, getEnd);
    const c = laned.find((l) => l.item.id === "c")!;
    expect(c.lane).toBe(0);
    expect(c.lanes).toBe(1);
  });
});
