import createDayReader from "./createDayReader.js";
import type { WorkingClock } from "./types.js";

const dayMilliseconds = 86_400_000;
const weekMilliseconds = 7 * dayMilliseconds;

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
  const workingWeek = clock.workdays.length * dayMilliseconds;
  let day = readDay(start.getTime());
  let remaining = milliseconds;
  while (!day.working || remaining > day.end - day.start) {
    if (day.working) remaining -= day.end - day.start;
    day = readDay(day.end);
    // From a local midnight, seven days on at the same offset is local
    // midnight again. A zone that changes its clock and back within those
    // days would keep the offset equal at both ends, and some have, as
    // three in Brazil did in October 2000. Those changes fall at a local
    // midnight, and each skip starts at one, so no week skipped holds
    // both. The week between holds each workday once at 24 hours, and it
    // is skipped whole rather than walked day by day.
    while (remaining > workingWeek) {
      const later = readDay(day.start + weekMilliseconds);
      if (later.offset !== day.offset) break;
      remaining -= workingWeek;
      day = later;
    }
  }
  return new Date(day.start + remaining);
}
