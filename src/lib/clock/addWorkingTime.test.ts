import { describe, expect, it, vi } from "vitest";
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

  it("carries 52 working weeks across two clock changes to the same weekday and hour", () => {
    expect(
      addWorkingTime(at("2026-09-25T16:00+02:00"), hours(52 * 120), paris),
    ).toEqual(at("2027-09-24T16:00+02:00"));
  });

  it("walks a week in which the clocks change rather than skipping it", () => {
    // Sunday 29 March 2026 lasts 23 hours in Paris, and is the only workday.
    const sundays: WorkingClock = { ...paris, workdays: ["sun"] };
    expect(
      addWorkingTime(at("2026-03-27T12:00+01:00"), hours(25), sundays),
    ).toEqual(at("2026-04-05T02:00+02:00"));
  });

  it("skips whole weeks rather than reading every day of a long duration", () => {
    const reads = vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts");
    const due = addWorkingTime(
      at("2026-09-25T16:00+02:00"),
      hours(260 * 120),
      paris,
    );
    expect(due).toEqual(at("2031-09-19T16:00+02:00"));
    // Fewer readings than the 1,300 workdays the duration spans.
    expect(reads.mock.calls.length).toBeLessThan(1300);
    reads.mockRestore();
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
