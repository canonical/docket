import { describe, expect, it, vi } from "vitest";
import { hourMilliseconds, weekdays } from "./constants.js";
import createDayReader from "./createDayReader.js";
import measureWorkingTime from "./measureWorkingTime.js";
import type { WorkingClock } from "./types.js";

/** Counts working time one day at a time, the plainest correct way. */
function walkDayByDay(start: Date, end: Date, clock: WorkingClock): number {
  const readDay = createDayReader(clock);
  const until = end.getTime();
  let total = 0;
  for (let from = start.getTime(); from < until; ) {
    const day = readDay(from);
    if (day.working) total += Math.min(day.end, until) - day.start;
    from = day.end;
  }
  return total;
}

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

  it("counts a week in which the zone changes its clock and back at its real length", () => {
    // Recife kept summer time only from 8 to 15 October 2000: a Sunday of
    // 23 hours and a Saturday of 25, less than seven days apart.
    const start = new Date("2000-10-08T02:30:00Z");
    const end = new Date("2000-10-18T02:30:00Z");
    const sundays = { workdays: ["sun"], timezone: "America/Recife" } as const;
    const saturdays = { ...sundays, workdays: ["sat"] } as const;
    expect(measureWorkingTime(start, end, sundays)).toBe(
      walkDayByDay(start, end, sundays),
    );
    expect(measureWorkingTime(start, end, sundays)).toBe(hours(47));
    expect(measureWorkingTime(start, end, saturdays)).toBe(hours(25.5));
  });

  it("reads the zone's calendar a few times a week rather than once a day", () => {
    const reads = vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts");
    expect(
      between("2024-09-02T12:00+02:00", "2026-08-31T12:00+02:00", paris),
    ).toBe(hours(520 * 24));
    // Under half as many readings as the 729 days the span touches: two
    // a week, at its end and midweek.
    expect(reads.mock.calls.length).toBeLessThan(729 / 2);
    reads.mockRestore();
  });

  // The walk reads the zone once for each of about 82,000 local days, and
  // the measure reads it about 27,000 times more: one to two seconds on an
  // idle machine, and up to six under heavy load, past vitest's five-second
  // default.
  it("gives what walking the span day by day gives, over random spans and zones", {
    timeout: 20_000,
  }, () => {
    let seed = 20_260_927;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const zones = [
      "UTC",
      "Europe/Paris",
      "America/Santiago",
      "Australia/Lord_Howe",
      "Pacific/Apia",
      "Asia/Kolkata",
      "America/Sao_Paulo",
    ];
    const year = 365 * 24 * hourMilliseconds;
    for (let run = 0; run < 150; run += 1) {
      const clock: WorkingClock = {
        workdays: weekdays.filter(() => random() < 0.6),
        timezone: zones[Math.floor(random() * zones.length)] as string,
      };
      const start = new Date(Date.UTC(2005, 0, 1) + random() * 25 * year);
      const end = new Date(start.getTime() + random() * 3 * year);
      expect(measureWorkingTime(start, end, clock)).toBe(
        walkDayByDay(start, end, clock),
      );
    }
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
