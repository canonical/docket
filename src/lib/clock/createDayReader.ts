import type { Weekday, WorkingClock } from "./types.js";

/** One calendar day in the clock's zone, as a span of instants. */
export interface Day {
  /** The instant the reading starts from, which may fall mid-day. */
  readonly start: number;
  /** The first instant of the next day. */
  readonly end: number;
  readonly working: boolean;
}

interface LocalTime {
  /** The local calendar date, as the UTC midnight that shares its digits. */
  readonly date: number;
  /** How far the local wall clock runs ahead of UTC, in milliseconds. */
  readonly offset: number;
  readonly weekday: Weekday;
}

const dayMilliseconds = 86_400_000;

function createLocalTimeReader(
  timezone: string,
): (instant: number) => LocalTime {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  return (instant) => {
    const parts = Object.fromEntries(
      format.formatToParts(instant).map(({ type, value }) => [type, value]),
    );
    const date = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
    );
    const wall =
      date +
      ((Number(parts.hour) * 60 + Number(parts.minute)) * 60 +
        Number(parts.second)) *
        1000;
    return {
      date,
      offset: wall - Math.floor(instant / 1000) * 1000,
      weekday: String(parts.weekday).toLowerCase() as Weekday,
    };
  };
}

/**
 * Finds the first instant whose local date comes after `today`'s.
 *
 * Local midnight is tried at the offset in force now and at the offset in
 * force at that first guess. Where a clock change skips midnight, the first
 * guess lands on the change itself; where a change repeats the evening, the
 * second guess lands on the real midnight. The earliest guess that falls on
 * a later date is the boundary.
 */
function findNextDayStart(
  today: LocalTime,
  read: (instant: number) => LocalTime,
): number {
  const midnight = today.date + dayMilliseconds;
  const first = midnight - today.offset;
  const second = midnight - read(first).offset;
  return Math.min(
    ...[first, second].filter((guess) => read(guess).date > today.date),
  );
}

/**
 * Prepares a reader of the clock's calendar. Given an instant, the reader
 * gives the span from that instant to the start of the next local day, and
 * says whether the clock runs on that day. A day on which the zone changes
 * its clock lasts its real length, 23 or 25 hours.
 */
export default function createDayReader(
  clock: WorkingClock,
): (from: number) => Day {
  const read = createLocalTimeReader(clock.timezone);
  return (from) => {
    const today = read(from);
    return {
      start: from,
      end: findNextDayStart(today, read),
      working: clock.workdays.includes(today.weekday),
    };
  };
}
