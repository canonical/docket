import { describe, expect, it } from "vitest";
import describeWorkingTime from "./describeWorkingTime.js";

const hour = 3_600_000;

describe("describeWorkingTime", () => {
  it("writes less than a working day in whole hours, rounded down", () => {
    expect(describeWorkingTime(14.9 * hour)).toBe("14h");
    expect(describeWorkingTime(59 * 60_000)).toBe("0h");
  });

  it("writes a working day or more in whole days, rounded down", () => {
    expect(describeWorkingTime(24 * hour)).toBe("1d");
    expect(describeWorkingTime(71 * hour)).toBe("2d");
  });
});
