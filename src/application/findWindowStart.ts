import { type Duration, measureDuration } from "../lib/clock/index.js";
import type { Settings } from "../lib/config/index.js";

const day = 86_400_000;

/**
 * How far back to read so that nothing inside a window of working time
 * before `now` is missed, on the repository's own clock. Every seven days
 * hold each workday once, so `n` weeks hold `n` working weeks; a day more
 * covers a clock change.
 *
 * @param settings The settings in effect for the repository.
 */
export default function findWindowStart(
  window: Duration,
  settings: Settings,
  now: Date,
): Date {
  const workingWeek = settings.time.workdays.length * day;
  const weeks = Math.ceil(measureDuration(window, settings.time) / workingWeek);
  return new Date(now.getTime() - weeks * 7 * day - day);
}
