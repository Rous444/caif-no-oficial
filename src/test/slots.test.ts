import { describe, expect, it } from "vitest";
import { generateSlots } from "@/lib/slots";

// Wednesday, 2026-07-15 -> weekday index (mon=0..sun=6) is 2
const WEDNESDAY = new Date(2026, 6, 15);

function label(hour: number, minute: number): string {
  return new Date(2026, 6, 15, hour, minute).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

describe("generateSlots", () => {
  it("supports multiple schedule blocks on the same day", () => {
    const weekday = (WEDNESDAY.getDay() + 6) % 7;
    const slots = generateSlots({
      date: WEDNESDAY,
      schedule: [
        { weekday, startTime: "08:00", endTime: "09:00" },
        { weekday, startTime: "14:00", endTime: "15:00" },
      ],
      occupied: [],
      slotMinutes: 30,
    });

    expect(slots.map((s) => s.label)).toEqual([
      label(8, 0),
      label(8, 30),
      label(14, 0),
      label(14, 30),
    ]);
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it("marks a slot unavailable on partial overlap with an existing appointment", () => {
    const weekday = (WEDNESDAY.getDay() + 6) % 7;
    const slotStart = new Date(2026, 6, 15, 8, 0);
    const occupiedStart = new Date(2026, 6, 15, 8, 15);
    const occupiedEnd = new Date(2026, 6, 15, 8, 45);

    const slots = generateSlots({
      date: WEDNESDAY,
      schedule: [{ weekday, startTime: "08:00", endTime: "09:00" }],
      occupied: [{ start: occupiedStart, end: occupiedEnd }],
      slotMinutes: 30,
    });

    const first = slots.find((s) => s.value === slotStart.toISOString());
    expect(first?.available).toBe(false);

    const second = slots.find((s) => s.value === new Date(2026, 6, 15, 8, 30).toISOString());
    expect(second?.available).toBe(false);
  });

  it("hides past slots for today when now is provided", () => {
    const weekday = (WEDNESDAY.getDay() + 6) % 7;
    const now = new Date(2026, 6, 15, 8, 45);

    const slots = generateSlots({
      date: WEDNESDAY,
      schedule: [{ weekday, startTime: "08:00", endTime: "10:00" }],
      occupied: [],
      slotMinutes: 30,
      now,
    });

    expect(slots.map((s) => s.label)).toEqual([label(9, 0), label(9, 30)]);
  });

  it("does not hide past slots when now is not provided", () => {
    const weekday = (WEDNESDAY.getDay() + 6) % 7;

    const slots = generateSlots({
      date: WEDNESDAY,
      schedule: [{ weekday, startTime: "08:00", endTime: "09:00" }],
      occupied: [],
      slotMinutes: 30,
    });

    expect(slots.map((s) => s.label)).toEqual([label(8, 0), label(8, 30)]);
  });

  it("generates correct slots for a non-30 slotMinutes value (15)", () => {
    const weekday = (WEDNESDAY.getDay() + 6) % 7;

    const slots = generateSlots({
      date: WEDNESDAY,
      schedule: [{ weekday, startTime: "08:00", endTime: "09:00" }],
      occupied: [],
      slotMinutes: 15,
    });

    expect(slots.map((s) => s.label)).toEqual([
      label(8, 0),
      label(8, 15),
      label(8, 30),
      label(8, 45),
    ]);
  });

  it("generates correct slots for a non-30 slotMinutes value (45)", () => {
    const weekday = (WEDNESDAY.getDay() + 6) % 7;

    const slots = generateSlots({
      date: WEDNESDAY,
      schedule: [{ weekday, startTime: "08:00", endTime: "10:00" }],
      occupied: [],
      slotMinutes: 45,
    });

    expect(slots.map((s) => s.label)).toEqual([label(8, 0), label(8, 45)]);
  });

  it("returns an empty array when there is no schedule block for the day", () => {
    const weekday = (WEDNESDAY.getDay() + 6) % 7;
    const otherWeekday = (weekday + 1) % 7;

    const slots = generateSlots({
      date: WEDNESDAY,
      schedule: [{ weekday: otherWeekday, startTime: "08:00", endTime: "09:00" }],
      occupied: [],
      slotMinutes: 30,
    });

    expect(slots).toEqual([]);
  });

  it("excludes a slot that would overflow past blockEnd", () => {
    const weekday = (WEDNESDAY.getDay() + 6) % 7;

    const slots = generateSlots({
      date: WEDNESDAY,
      schedule: [{ weekday, startTime: "08:00", endTime: "08:50" }],
      occupied: [],
      slotMinutes: 30,
    });

    // 08:00-08:30 fits, 08:30-09:00 would overflow past 08:50 block end
    expect(slots.map((s) => s.label)).toEqual([label(8, 0)]);
  });

  it("includes a slot when it ends exactly at blockEnd (boundary inclusive)", () => {
    const weekday = (WEDNESDAY.getDay() + 6) % 7;

    const slots = generateSlots({
      date: WEDNESDAY,
      schedule: [{ weekday, startTime: "08:00", endTime: "09:00" }],
      occupied: [],
      slotMinutes: 30,
    });

    // last slot 08:30-09:00 ends exactly at blockEnd -> must be included
    expect(slots.map((s) => s.label)).toEqual([label(8, 0), label(8, 30)]);
  });

  it("treats occupied ranges as already filtered by caller (no cancelado handling inside)", () => {
    const weekday = (WEDNESDAY.getDay() + 6) % 7;

    // Caller is responsible for excluding status === "cancelado" appointments
    // before building the occupied ranges. Simulate the caller having already
    // filtered a cancelado appointment out, leaving no occupied ranges.
    const slots = generateSlots({
      date: WEDNESDAY,
      schedule: [{ weekday, startTime: "08:00", endTime: "08:30" }],
      occupied: [],
      slotMinutes: 30,
    });

    expect(slots).toEqual([{ value: expect.any(String), label: label(8, 0), available: true }]);
  });
});
