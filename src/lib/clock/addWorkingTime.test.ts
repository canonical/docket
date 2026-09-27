import { describe, expect, it } from "vitest";
import addWorkingTime from "./addWorkingTime.js";
import { hourMilliseconds } from "./constants.js";
import type { WorkingClock } from "./types.js";

const paris: WorkingClock = {
  workdays: ["mon", "tue", "wed", "thu", "fri"],
  timezone: "Europe/Paris",
};
const hours = (count: number) => count * hourMilliseconds;
const at = (iso: string) => new Date(iso);

describe("addWorkingTime", () => {
  it("falls due within the same workday when the time fits", () => {
    expect(
      addWorkingTime(at("2026-09-22T10:00+02:00"), hours(5), paris),
    ).toEqual(at("2026-09-22T15:00+02:00"));
  });

  it("carries a 24-hour target set on Friday at 16:00 to Monday at 16:00", () => {
    expect(
      addWorkingTime(at("2026-09-25T16:00+02:00"), hours(24), paris),
    ).toEqual(at("2026-09-28T16:00+02:00"));
  });

  it("starts counting at Monday's midnight when set during the weekend", () => {
    expect(
      addWorkingTime(at("2026-09-26T10:00+02:00"), hours(24), paris),
    ).toEqual(at("2026-09-29T00:00+02:00"));
  });

  it("keeps Monday at 16:00 when the clocks go forward over the weekend", () => {
    expect(
      addWorkingTime(at("2026-03-27T16:00+01:00"), hours(24), paris),
    ).toEqual(at("2026-03-30T16:00+02:00"));
  });

  it("keeps Monday at 16:00 when the clocks go back over the weekend", () => {
    expect(
      addWorkingTime(at("2026-10-23T16:00+02:00"), hours(24), paris),
    ).toEqual(at("2026-10-26T16:00+01:00"));
  });

  it("counts real hours across a workday on which the clocks go forward", () => {
    const everyDay: WorkingClock = {
      ...paris,
      workdays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    };
    expect(
      addWorkingTime(at("2026-03-28T12:00+01:00"), hours(24), everyDay),
    ).toEqual(at("2026-03-29T13:00+02:00"));
  });

  it("reads the workdays in the clock's time zone", () => {
    const tokyo: WorkingClock = { ...paris, timezone: "Asia/Tokyo" };
    // Friday 23:00 in UTC is already Saturday morning in Tokyo.
    expect(addWorkingTime(at("2026-09-25T23:00Z"), hours(1), tokyo)).toEqual(
      at("2026-09-28T01:00+09:00"),
    );
  });

  it("refuses a clock with no workdays", () => {
    expect(() =>
      addWorkingTime(at("2026-09-25T16:00Z"), hours(1), {
        ...paris,
        workdays: [],
      }),
    ).toThrow(RangeError);
  });
});
