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
 * more than a week of readings, so every caller in a zone shares one.
 * Each keeps up to 4096 readings by whole second, the precision the
 * formatter provides, and clears them together when full.
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
  const readings = new Map<number, LocalTime>();
  return (instant) => {
    const second = Math.floor(instant / 1000);
    const known = readings.get(second);
    if (known) return known;
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
    const result = {
      date,
      offset: wall - second * 1000,
      weekday: String(parts.weekday).toLowerCase() as Weekday,
    };
    if (readings.size >= 4096) readings.clear();
    readings.set(second, result);
    return result;
  };
}

/**
 * Gives the reader of the local time `timezone` shows at an instant, with
 * one formatter per zone and a bounded cache for repeated instants.
 */
export default function createLocalTimeReader(timezone: string): Reader {
  let reader = readers.get(timezone);
  if (!reader) {
    reader = buildReader(timezone);
    readers.set(timezone, reader);
  }
  return reader;
}
