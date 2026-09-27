import createDayReader from "./createDayReader.js";
import type { WorkingClock } from "./types.js";

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
  const until = end.getTime();
  let total = 0;
  for (let from = start.getTime(); from < until; ) {
    const day = readDay(from);
    if (day.working) total += Math.min(day.end, until) - day.start;
    from = day.end;
  }
  return total;
}
