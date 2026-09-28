import { describe, expect, it } from "vitest";
import describeClock from "./describeClock.js";

describe("describeClock", () => {
  it("writes the hour and minute in the time zone given", () => {
    const at = new Date("2026-09-28T14:20:00Z");
    expect(describeClock(at, "UTC")).toBe("14:20");
    expect(describeClock(at, "Europe/Paris")).toBe("16:20");
  });

  it("writes midnight as 00:00", () => {
    expect(describeClock(new Date("2026-09-28T00:05:00Z"), "UTC")).toBe(
      "00:05",
    );
  });
});
