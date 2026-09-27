import { describe, expect, it } from "vitest";
import { hourMilliseconds } from "./constants.js";
import measureDuration from "./measureDuration.js";
import type { WorkingClock } from "./types.js";

const weekdaysOnly: WorkingClock = {
  workdays: ["mon", "tue", "wed", "thu", "fri"],
  timezone: "UTC",
};

describe("measureDuration", () => {
  it("gives hours as they are written", () => {
    expect(measureDuration({ amount: 5, unit: "h" }, weekdaysOnly)).toBe(
      5 * hourMilliseconds,
    );
  });

  it("makes one working day as long as 24 hours", () => {
    expect(measureDuration({ amount: 1, unit: "d" }, weekdaysOnly)).toBe(
      measureDuration({ amount: 24, unit: "h" }, weekdaysOnly),
    );
  });

  it("makes one working week as many working days as the clock has workdays", () => {
    expect(measureDuration({ amount: 1, unit: "w" }, weekdaysOnly)).toBe(
      120 * hourMilliseconds,
    );
    const sixDays = {
      ...weekdaysOnly,
      workdays: [...weekdaysOnly.workdays, "sat"],
    } as const;
    expect(measureDuration({ amount: 2, unit: "w" }, sixDays)).toBe(
      288 * hourMilliseconds,
    );
  });
});
