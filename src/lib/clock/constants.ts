import type { Weekday } from "./types.js";

/** Every day of the week, in calendar order from Monday. */
export const weekdays: readonly Weekday[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

/** One hour, in milliseconds. */
export const hourMilliseconds = 3_600_000;
