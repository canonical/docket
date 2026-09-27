import createDayReader from "./createDayReader.js";
import createLocalTimeReader from "./createLocalTimeReader.js";
import type { WorkingClock } from "./types.js";

const dayMilliseconds = 86_400_000;
const weekMilliseconds = 7 * dayMilliseconds;

/**
 * Counts the working time between two instants, in milliseconds: the part
 * of the span that falls on the clock's workdays, in its time zone. A span
 * that ends before it starts holds no working time.
 */
export default function measureWorkingTime(
  start: Date,
  end: Date,
  clock: WorkingClock,
): number {
  const readDay = createDayReader(clock);
  const readLocalTime = createLocalTimeReader(clock.timezone);
  const workingWeek = clock.workdays.length * dayMilliseconds;
  const until = end.getTime();
  let total = 0;
  let day = readDay(start.getTime());
  while (day.start < until) {
    // Seven days on at the same offset is the same local time again. No
    // zone changes its clock and back within a week, so the week between
    // holds each workday once at 24 hours, and it is counted whole rather
    // than walked day by day, with one reading of the zone per week.
    let from = day.start;
    while (
      until - from > weekMilliseconds &&
      readLocalTime(from + weekMilliseconds).offset === day.offset
    ) {
      total += workingWeek;
      from += weekMilliseconds;
    }
    if (from !== day.start) day = readDay(from);
    if (day.working) total += Math.min(day.end, until) - day.start;
    day = readDay(day.end);
  }
  return total;
}
