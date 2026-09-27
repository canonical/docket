import createDayReader from "./createDayReader.js";
import type { WorkingClock } from "./types.js";

/**
 * Finds the instant at which `milliseconds` of working time have passed
 * since `start`. The clock runs continuously on workdays and stands still
 * on every other day, so 24 hours from Friday at 16:00 falls on Monday at
 * 16:00 on a Monday-to-Friday clock.
 *
 * @throws RangeError when the clock has no workdays, because no amount of
 * working time would ever pass.
 */
export default function addWorkingTime(
  start: Date,
  milliseconds: number,
  clock: WorkingClock,
): Date {
  if (clock.workdays.length === 0) {
    throw new RangeError("A working clock needs at least one workday.");
  }
  const readDay = createDayReader(clock);
  let day = readDay(start.getTime());
  let remaining = milliseconds;
  while (!day.working || remaining > day.end - day.start) {
    if (day.working) remaining -= day.end - day.start;
    day = readDay(day.end);
  }
  return new Date(day.start + remaining);
}
