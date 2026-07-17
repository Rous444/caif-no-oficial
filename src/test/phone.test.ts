import { describe, expect, it } from "vitest";
import {
  formatArPhone,
  isValidArPhone,
  normalizeArPhoneDigits,
  toWaLink,
  toWaPhone,
} from "@/lib/phone";

// Números de ejemplo ficticios (no corresponden a personas reales).
const FOUR_DIGIT_AREA_RAW = "5493440112233"; // área ficticia de 4 dígitos (3440) + local
const THREE_DIGIT_AREA_RAW = "5493511234567"; // 351 = Córdoba (3 dígitos) + local
const TWO_DIGIT_AREA_RAW = "5491122334455"; // 11 = CABA/GBA (2 dígitos) + local

describe("normalizeArPhoneDigits", () => {
  it("strips the 54 country code and 9 mobile prefix", () => {
    expect(normalizeArPhoneDigits(FOUR_DIGIT_AREA_RAW)).toBe("3440112233");
  });

  it("leaves a plain 10-digit local number untouched", () => {
    expect(normalizeArPhoneDigits("3440112233")).toBe("3440112233");
  });

  it("strips non-digit characters typed by the user", () => {
    expect(normalizeArPhoneDigits("+54 9 3440 11-2233")).toBe("3440112233");
  });

  it("truncates to 10 local digits", () => {
    expect(normalizeArPhoneDigits("344011223399")).toBe("3440112233");
  });

  it("handles partial input while typing", () => {
    expect(normalizeArPhoneDigits("54934")).toBe("34");
  });
});

describe("isValidArPhone", () => {
  it("accepts a full 549 + 10 digit number", () => {
    expect(isValidArPhone(FOUR_DIGIT_AREA_RAW)).toBe(true);
  });

  it("accepts a bare 10-digit local number", () => {
    expect(isValidArPhone("3440112233")).toBe(true);
  });

  it("rejects a short number", () => {
    expect(isValidArPhone("344011")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidArPhone("")).toBe(false);
  });
});

describe("formatArPhone", () => {
  it("formats a 4-digit area code as +54 9 AAAA MM-LLLL", () => {
    expect(formatArPhone(FOUR_DIGIT_AREA_RAW)).toBe("+54 9 3440 11-2233");
  });

  it("formats a known 3-digit area code (Córdoba) as +54 9 AAA MMM-LLLL", () => {
    expect(formatArPhone(THREE_DIGIT_AREA_RAW)).toBe("+54 9 351 123-4567");
  });

  it("formats the 2-digit CABA/GBA area code as +54 9 11 MMMM-LLLL", () => {
    expect(formatArPhone(TWO_DIGIT_AREA_RAW)).toBe("+54 9 11 2233-4455");
  });

  it("formats progressively as the user types a 4-digit-area number", () => {
    expect(formatArPhone("3")).toBe("+54 9 3");
    expect(formatArPhone("3440")).toBe("+54 9 3440");
    expect(formatArPhone("344011")).toBe("+54 9 3440 11");
    expect(formatArPhone("34401122")).toBe("+54 9 3440 1122");
    expect(formatArPhone("344011223")).toBe("+54 9 3440 1-1223");
  });

  it("returns an empty string for empty input", () => {
    expect(formatArPhone("")).toBe("");
  });
});

describe("toWaPhone / toWaLink", () => {
  it("builds the wa.me digit string with the 549 prefix", () => {
    expect(toWaPhone("3440112233")).toBe("5493440112233");
    expect(toWaPhone(FOUR_DIGIT_AREA_RAW)).toBe("5493440112233");
  });

  it("builds a wa.me link with an encoded prefilled message", () => {
    expect(toWaLink("3440112233", "Hola, quisiera coordinar un turno")).toBe(
      "https://wa.me/5493440112233?text=Hola%2C%20quisiera%20coordinar%20un%20turno",
    );
  });
});
