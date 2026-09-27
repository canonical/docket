import type { Weekday, WorkingClock } from "./types.js";

/** One calendar day in the clock's zone, as a span of instants. */
export interface Day {
  /** The instant the reading starts from, which may fall mid-day. */
  readonly start: number;
  /** The first instant of the next day. */
  readonly end: number;
  /** How far the local wall clock runs ahead of UTC at `start`. */
  readonly offset: number;
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

/** An instant, and the local time the clock's zone shows at it. */
interface Reading {
  readonly instant: number;
  readonly local: LocalTime;
}

/**
 * Finds the first instant whose local date comes after `today`'s.
 *
 * Local midnight is tried first at the offset in force today. When the
 * offset there is the same, that guess is local midnight. Otherwise the
 * clock changes before it, and midnight is tried again at the offset in
 * force at the first guess. When the clocks go forward, that second guess
 * is the real midnight, or falls on today where the change skips midnight,
 * and then the first guess lands on the change itself. When the clocks go
 * back, the first guess falls on today, and the second is the real
 * midnight.
 */
function findNextDayStart(
  today: LocalTime,
  read: (instant: number) => LocalTime,
): Reading {
  const midnight = today.date + dayMilliseconds;
  const first = midnight - today.offset;
  const atFirst = read(first);
  if (atFirst.offset === today.offset)
    return { instant: first, local: atFirst };
  const second = midnight - atFirst.offset;
  const atSecond = read(second);
  return atSecond.date > today.date
    ? { instant: second, local: atSecond }
    : { instant: first, local: atFirst };
}

/**
 * Prepares a reader of the clock's calendar. Given an instant, the reader
 * gives the span from that instant to the start of the next local day, and
 * says whether the clock runs on that day. A day on which the zone changes
 * its clock lasts its real length, 23 or 25 hours.
 *
 * Reading day after day, each day's start is the previous day's end, so the
 * reader keeps the local time it found there rather than reading it again.
 */
export default function createDayReader(
  clock: WorkingClock,
): (from: number) => Day {
  const read = createLocalTimeReader(clock.timezone);
  let next: Reading | undefined;
  return (from) => {
    const today = next?.instant === from ? next.local : read(from);
    next = findNextDayStart(today, read);
    return {
      start: from,
      end: next.instant,
      offset: today.offset,
      working: clock.workdays.includes(today.weekday),
    };
  };
}
