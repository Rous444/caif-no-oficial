import { describe, expect, it } from "vitest";
import { parseDataUrl, toDataUrl } from "@/lib/dataUrl.server";

describe("parseDataUrl", () => {
  it("splits a data URL into its mime type and decoded bytes", () => {
    const { mime, buffer } = parseDataUrl("data:image/png;base64,aGVsbG8=");
    expect(mime).toBe("image/png");
    expect(buffer.toString()).toBe("hello");
  });

  it("throws on a string that isn't a base64 data URL", () => {
    expect(() => parseDataUrl("not-a-data-url")).toThrow(/inválid/i);
  });
});

describe("toDataUrl", () => {
  it("rebuilds a data URL from a mime type and bytes", () => {
    expect(toDataUrl("image/png", Buffer.from("hello"))).toBe("data:image/png;base64,aGVsbG8=");
  });

  it("round-trips through parseDataUrl", () => {
    const original = toDataUrl("image/jpeg", Buffer.from([1, 2, 3, 250]));
    const { mime, buffer } = parseDataUrl(original);
    expect(mime).toBe("image/jpeg");
    expect([...buffer]).toEqual([1, 2, 3, 250]);
  });
});
