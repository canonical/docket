import { describe, expect, it } from "vitest";
import { hourMilliseconds } from "./constants.js";
import createDayReader from "./createDayReader.js";
import type { WorkingClock } from "./types.js";

const paris: WorkingClock = {
  workdays: ["mon", "tue", "wed", "thu", "fri"],
  timezone: "Europe/Paris",
};
const at = (text: string) => new Date(text).getTime();

describe("createDayReader", () => {
  it("gives the span from a mid-day instant to the next local midnight", () => {
    const read = createDayReader(paris);
    expect(read(at("2026-09-22T09:30+02:00"))).toEqual({
      start: at("2026-09-22T09:30+02:00"),
      end: at("2026-09-23T00:00+02:00"),
      offset: 2 * hourMilliseconds,
      working: true,
    });
  });

  it("says a day outside the workdays is not working", () => {
    const read = createDayReader(paris);
    expect(read(at("2026-09-26T00:00+02:00")).working).toBe(false);
  });

  it("reads the weekday in the clock's time zone", () => {
    const tokyo = { ...paris, timezone: "Asia/Tokyo" };
    // Sunday evening in UTC is already Monday in Tokyo.
    const instant = at("2026-09-27T20:00Z");
    expect(createDayReader(tokyo)(instant).working).toBe(true);
    expect(
      createDayReader({ ...paris, timezone: "UTC" })(instant).working,
    ).toBe(false);
  });

  it("gives a day on which the clocks go forward its 23 hours", () => {
    const read = createDayReader(paris);
    const day = read(at("2026-03-29T00:00+01:00"));
    expect(day.end - day.start).toBe(23 * hourMilliseconds);
    expect(day.end).toBe(at("2026-03-30T00:00+02:00"));
  });

  it("gives a day on which the clocks go back its 25 hours", () => {
    const read = createDayReader(paris);
    const day = read(at("2026-10-25T00:00+02:00"));
    expect(day.end - day.start).toBe(25 * hourMilliseconds);
    expect(day.end).toBe(at("2026-10-26T00:00+01:00"));
  });

  it("ends the day at the change when the clocks skip midnight", () => {
    // Santiago moves from 00:00 to 01:00 on the first Sunday of September.
    const santiago = { ...paris, timezone: "America/Santiago" };
    const day = createDayReader(santiago)(at("2026-09-05T12:00-04:00"));
    expect(day.end).toBe(at("2026-09-06T01:00-03:00"));
  });

  it("walks day after day, each starting where the previous ended", () => {
    const read = createDayReader(paris);
    const monday = read(at("2026-09-21T00:00+02:00"));
    const tuesday = read(monday.end);
    expect(tuesday).toEqual({
      start: at("2026-09-22T00:00+02:00"),
      end: at("2026-09-23T00:00+02:00"),
      offset: 2 * hourMilliseconds,
      working: true,
    });
  });

  it("reads an instant afresh when it is not where the last day ended", () => {
    const read = createDayReader(paris);
    read(at("2026-09-21T00:00+02:00"));
    expect(read(at("2026-09-26T08:00+02:00"))).toEqual({
      start: at("2026-09-26T08:00+02:00"),
      end: at("2026-09-27T00:00+02:00"),
      offset: 2 * hourMilliseconds,
      working: false,
    });
  });
});
