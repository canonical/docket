import type { Weekday } from "./types.js";

/** The local time a zone shows at an instant. */
export interface LocalTime {
  /** The local calendar date, as the UTC midnight that shares its digits. */
  readonly date: number;
  /** How far the local wall clock runs ahead of UTC, in milliseconds. */
  readonly offset: number;
  readonly weekday: Weekday;
}

type Reader = (instant: number) => LocalTime;

/**
 * The reader of each zone asked for so far. Building a formatter costs
 * more than a week of readings, and a reader holds nothing but its
 * formatter, so every caller in a zone shares one.
 */
const readers = new Map<string, Reader>();

/** Builds a reader of the local time `timezone` shows at an instant. */
function buildReader(timezone: string): Reader {
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
 * Gives the reader of the local time `timezone` shows at an instant, with
 * one formatter per zone for every reading.
 */
export default function createLocalTimeReader(timezone: string): Reader {
  let reader = readers.get(timezone);
  if (!reader) {
    reader = buildReader(timezone);
    readers.set(timezone, reader);
  }
  return reader;
}
