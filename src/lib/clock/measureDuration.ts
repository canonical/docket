import { hourMilliseconds } from "./constants.js";
import type { Duration, WorkingClock } from "./types.js";

/**
 * Gives a duration's length in working time, in milliseconds.
 *
 * A working day is 24 hours, so `1d` and `24h` are the same length. A
 * working week is as many working days as the clock has workdays, so `1w`
 * is 120 hours on a Monday-to-Friday clock.
 */
export default function measureDuration(
  duration: Duration,
  clock: WorkingClock,
): number {
  const hours = { h: 1, d: 24, w: 24 * clock.workdays.length }[duration.unit];
  return duration.amount * hours * hourMilliseconds;
}
