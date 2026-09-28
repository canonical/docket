import { type Duration, measureDuration } from "../lib/clock/index.js";
import type { Settings } from "../lib/config/index.js";
import type { ThreadEvent } from "../lib/events/index.js";
import type { Watched } from "./types.js";

const day = 86_400_000;

/**
 * How far back to ask for events so that none inside a window of working
 * time is missed. Every seven days hold each workday once, so `n` weeks
 * hold `n` working weeks; a day more covers a clock change.
 */
function findEarliest(window: Duration, settings: Settings, now: Date): Date {
  const workingWeek = settings.time.workdays.length * day;
  const weeks = Math.ceil(measureDuration(window, settings.time) / workingWeek);
  return new Date(now.getTime() - weeks * 7 * day - day);
}

/**
 * Reads the events of each watched repository from far enough back that
 * every event inside the window of working time before `now`, on that
 * repository's own clock, is among them.
 *
 * @param readEvents Gives the events of a repository at or after a time.
 * @returns Each repository's events, by its `owner/name`.
 * @note Impure: reads the events of each watched repository through
 * `readEvents`, one repository at a time.
 */
export default async function readWindowEvents(
  readEvents: (repo: string, since: Date) => Promise<readonly ThreadEvent[]>,
  watched: readonly Watched[],
  window: Duration,
  now: Date,
): Promise<ReadonlyMap<string, readonly ThreadEvent[]>> {
  const events = new Map<string, readonly ThreadEvent[]>();
  for (const { repo, resolved } of watched) {
    const since = findEarliest(window, resolved.settings, now);
    events.set(repo, await readEvents(repo, since));
  }
  return events;
}
