import type { Weekday } from "./types.js";

/** The local time a zone shows at an instant. */
export interface LocalTime {
  /** The local calendar date, as the UTC midnight that shares its digits. */
  readonly date: number;
  /** How far the local wall clock runs ahead of UTC, in milliseconds. */
  readonly offset: number;
  readonly weekday: Weekday;
}

/**
 * Prepares a reader of the local time `timezone` shows at an instant,
 * with one formatter for every reading.
 */
export default function createLocalTimeReader(
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
