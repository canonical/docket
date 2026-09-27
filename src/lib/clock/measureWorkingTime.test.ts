import { describe, expect, it, vi } from "vitest";
import { hourMilliseconds } from "./constants.js";
import measureWorkingTime from "./measureWorkingTime.js";
import type { WorkingClock } from "./types.js";

const paris: WorkingClock = {
  workdays: ["mon", "tue", "wed", "thu", "fri"],
  timezone: "Europe/Paris",
};
const hours = (count: number) => count * hourMilliseconds;
const between = (start: string, end: string, clock: WorkingClock) =>
  measureWorkingTime(new Date(start), new Date(end), clock);

describe("measureWorkingTime", () => {
  it("counts the whole span within one workday", () => {
    expect(
      between("2026-09-22T09:00+02:00", "2026-09-22T17:30+02:00", paris),
    ).toBe(hours(8.5));
  });

  it("leaves the weekend out of a span from Friday to Monday", () => {
    expect(
      between("2026-09-25T16:00+02:00", "2026-09-28T16:00+02:00", paris),
    ).toBe(hours(24));
  });

  it("counts nothing for a span inside the weekend", () => {
    expect(
      between("2026-09-26T08:00+02:00", "2026-09-27T20:00+02:00", paris),
    ).toBe(0);
  });

  it("counts nothing for a span that ends before it starts", () => {
    expect(
      between("2026-09-22T17:00+02:00", "2026-09-22T09:00+02:00", paris),
    ).toBe(0);
  });

  it("gives 24 hours from Friday to Monday when the clocks change over the weekend", () => {
    expect(
      between("2026-03-27T16:00+01:00", "2026-03-30T16:00+02:00", paris),
    ).toBe(hours(24));
    expect(
      between("2026-10-23T16:00+02:00", "2026-10-26T16:00+01:00", paris),
    ).toBe(hours(24));
  });

  it("reads the workdays in the clock's time zone", () => {
    const utc = { ...paris, timezone: "UTC" };
    const tokyo = { ...paris, timezone: "Asia/Tokyo" };
    // Friday 22:00 to 23:30 in UTC is Saturday morning in Tokyo.
    expect(between("2026-09-25T22:00Z", "2026-09-25T23:30Z", utc)).toBe(
      hours(1.5),
    );
    expect(between("2026-09-25T22:00Z", "2026-09-25T23:30Z", tokyo)).toBe(0);
  });

  it("starts the day after a clock change that skips midnight at the change", () => {
    // In Santiago on 6 September 2026, Saturday 24:00 becomes Sunday 01:00.
    const saturdays = {
      workdays: ["sat"],
      timezone: "America/Santiago",
    } as const;
    const sundays = { ...saturdays, workdays: ["sun"] } as const;
    const start = "2026-09-05T12:00-04:00";
    const end = "2026-09-06T12:00-03:00";
    expect(between(start, end, saturdays)).toBe(hours(12));
    expect(between(start, end, sundays)).toBe(hours(11));
  });

  it("gives a day 25 hours when a clock change repeats its last hour", () => {
    // In Santiago on 4 April 2026, Saturday 24:00 becomes Saturday 23:00.
    const saturdays = {
      workdays: ["sat"],
      timezone: "America/Santiago",
    } as const;
    expect(
      between("2026-04-04T00:00-03:00", "2026-04-06T00:00-04:00", saturdays),
    ).toBe(hours(25));
  });

  it("reads the zone's calendar about once per day of the span", () => {
    const reads = vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts");
    expect(
      between("2026-09-01T12:00+02:00", "2026-10-01T12:00+02:00", paris),
    ).toBe(hours(22 * 24));
    // The span touches 31 days: one reading for each, and one more for the
    // instant it starts at, mid-day.
    expect(reads).toHaveBeenCalledTimes(32);
    reads.mockRestore();
  });

  it("counts no time for a date the zone skipped", () => {
    // Samoa went from Thursday 29 to Saturday 31 December 2011.
    const fridays = { workdays: ["fri"], timezone: "Pacific/Apia" } as const;
    const thursdays = { ...fridays, workdays: ["thu"] } as const;
    const start = "2011-12-29T12:00-10:00";
    const end = "2011-12-31T12:00+14:00";
    expect(between(start, end, fridays)).toBe(0);
    expect(between(start, end, thursdays)).toBe(hours(12));
  });
});
