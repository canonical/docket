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
    // Seven days on at the same offset is the same local time again. When
    // the offset is also the same midweek, the week between holds each
    // workday once at 24 hours, and it is counted whole rather than walked
    // day by day. The midweek reading catches a zone that changes its
    // clock and back within the week, as Recife did from 8 to 15 October
    // 2000: no two changes on record are within half a week of each
    // other, so such a pair always falls on both sides of midweek.
    let from = day.start;
    while (
      until - from > weekMilliseconds &&
      readLocalTime(from + weekMilliseconds).offset === day.offset &&
      readLocalTime(from + weekMilliseconds / 2).offset === day.offset
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
