import { describe, expect, it } from "vitest";
import describeTime from "./describeTime.js";

describe("describeTime", () => {
  it("writes the date and time of day in the zone, and names the zone", () => {
    const at = new Date("2026-09-28T09:58:00Z");
    expect(describeTime(at, "Europe/Paris")).toBe(
      "2026-09-28 11:58 Europe/Paris",
    );
    expect(describeTime(at, "UTC")).toBe("2026-09-28 09:58 UTC");
  });

  it("writes midnight as 00:00 and keeps the local date", () => {
    expect(describeTime(new Date("2026-12-31T23:30:00Z"), "Europe/Paris")).toBe(
      "2027-01-01 00:30 Europe/Paris",
    );
  });
});
