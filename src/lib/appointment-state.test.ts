import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  rangesOverlap,
  deriveDisplayStatus,
  isWithinDoctorSchedule,
  AUTO_ATTENDED_MINUTES,
} from "./appointment-state";

describe("isValidTransition", () => {
  it("allows pendiente -> confirmado", () => {
    expect(isValidTransition("pendiente", "confirmado")).toBe(true);
  });

  it("allows pendiente -> cancelado", () => {
    expect(isValidTransition("pendiente", "cancelado")).toBe(true);
  });

  it("allows confirmado -> ausente", () => {
    expect(isValidTransition("confirmado", "ausente")).toBe(true);
  });

  it("allows confirmado -> cancelado", () => {
    expect(isValidTransition("confirmado", "cancelado")).toBe(true);
  });

  it("rejects confirmado -> completado (solo llega por auto-regla lazy, nunca por click)", () => {
    expect(isValidTransition("confirmado", "completado")).toBe(false);
  });

  it("rejects completado -> pendiente", () => {
    expect(isValidTransition("completado", "pendiente")).toBe(false);
  });

  it("rejects cancelado -> confirmado", () => {
    expect(isValidTransition("cancelado", "confirmado")).toBe(false);
  });

  it("rejects pendiente -> ausente (debe pasar por confirmado)", () => {
    expect(isValidTransition("pendiente", "ausente")).toBe(false);
  });

  it("rejects ausente -> cualquier cosa (estado final)", () => {
    expect(isValidTransition("ausente", "confirmado")).toBe(false);
    expect(isValidTransition("ausente", "completado")).toBe(false);
  });

  it("rejects same-state no-op transitions not explicitly listed", () => {
    expect(isValidTransition("pendiente", "pendiente")).toBe(false);
  });
});

describe("rangesOverlap", () => {
  it("detects overlap when ranges intersect", () => {
    const a1 = new Date("2026-07-15T10:00:00");
    const a2 = new Date("2026-07-15T10:30:00");
    const b1 = new Date("2026-07-15T10:15:00");
    const b2 = new Date("2026-07-15T10:45:00");
    expect(rangesOverlap(a1, a2, b1, b2)).toBe(true);
  });

  it("does not flag back-to-back ranges as overlapping", () => {
    const a1 = new Date("2026-07-15T10:00:00");
    const a2 = new Date("2026-07-15T10:30:00");
    const b1 = new Date("2026-07-15T10:30:00");
    const b2 = new Date("2026-07-15T11:00:00");
    expect(rangesOverlap(a1, a2, b1, b2)).toBe(false);
  });

  it("does not flag disjoint ranges as overlapping", () => {
    const a1 = new Date("2026-07-15T10:00:00");
    const a2 = new Date("2026-07-15T10:30:00");
    const b1 = new Date("2026-07-15T12:00:00");
    const b2 = new Date("2026-07-15T12:30:00");
    expect(rangesOverlap(a1, a2, b1, b2)).toBe(false);
  });
});

describe("deriveDisplayStatus", () => {
  const scheduledAt = new Date("2026-07-15T10:00:00");

  it("keeps confirmado before the horario + N minutos cutoff", () => {
    const now = new Date(scheduledAt.getTime() + (AUTO_ATTENDED_MINUTES - 1) * 60000);
    expect(deriveDisplayStatus("confirmado", scheduledAt, now)).toBe("confirmado");
  });

  it("derives completado once horario + N minutos passed for confirmado", () => {
    const now = new Date(scheduledAt.getTime() + (AUTO_ATTENDED_MINUTES + 1) * 60000);
    expect(deriveDisplayStatus("confirmado", scheduledAt, now)).toBe("completado");
  });

  it("derives completado once horario + N minutos passed for pendiente", () => {
    const now = new Date(scheduledAt.getTime() + (AUTO_ATTENDED_MINUTES + 1) * 60000);
    expect(deriveDisplayStatus("pendiente", scheduledAt, now)).toBe("completado");
  });

  it("never overrides a final state (cancelado/completado/ausente)", () => {
    const now = new Date(scheduledAt.getTime() + 999 * 60000);
    expect(deriveDisplayStatus("cancelado", scheduledAt, now)).toBe("cancelado");
    expect(deriveDisplayStatus("ausente", scheduledAt, now)).toBe("ausente");
    expect(deriveDisplayStatus("completado", scheduledAt, now)).toBe("completado");
  });
});

describe("isWithinDoctorSchedule", () => {
  const schedules = [
    { weekday: 3, startTime: "09:00", endTime: "13:00" },
    { weekday: 3, startTime: "15:00", endTime: "18:00" },
  ];

  it("accepts a slot fully inside a block", () => {
    // 2026-07-15 is a Wednesday (weekday 3)
    const scheduledAt = new Date("2026-07-15T10:00:00");
    expect(isWithinDoctorSchedule(scheduledAt, 30, schedules)).toBe(true);
  });

  it("rejects a slot that spills past the end of the block", () => {
    const scheduledAt = new Date("2026-07-15T12:45:00");
    expect(isWithinDoctorSchedule(scheduledAt, 30, schedules)).toBe(false);
  });

  it("rejects a slot on a weekday with no schedule", () => {
    const scheduledAt = new Date("2026-07-16T10:00:00"); // Thursday
    expect(isWithinDoctorSchedule(scheduledAt, 30, schedules)).toBe(false);
  });

  it("rejects a slot in the gap between two blocks of the same day", () => {
    const scheduledAt = new Date("2026-07-15T13:30:00");
    expect(isWithinDoctorSchedule(scheduledAt, 30, schedules)).toBe(false);
  });
});
