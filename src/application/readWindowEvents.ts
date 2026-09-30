import type { Duration } from "../lib/clock/index.js";
import {
  type ThreadEvent,
  type TimedEvent,
  timeEvents,
} from "../lib/events/index.js";
import findWindowStart from "./findWindowStart.js";
import type { Watched } from "./types.js";

/**
 * Reads the events of each watched repository from far enough back that
 * every event inside the window of working time before `now`, on that
 * repository's own clock, is among them, and times each against the
 * window on that clock once, so a list built at any later instant
 * compares instants rather than counting working time again.
 *
 * @param readEvents Gives the events of a repository at or after a time.
 * @returns Each repository's events, timed, by its `owner/name`.
 * @note Impure: reads the events of each watched repository through
 * `readEvents`, one repository at a time.
 */
export default async function readWindowEvents(
  readEvents: (repo: string, since: Date) => Promise<readonly ThreadEvent[]>,
  watched: readonly Watched[],
  window: Duration,
  now: Date,
): Promise<ReadonlyMap<string, readonly TimedEvent[]>> {
  const events = new Map<string, readonly TimedEvent[]>();
  for (const { repo, resolved } of watched) {
    const { settings } = resolved;
    const since = findWindowStart(window, settings, now);
    events.set(
      repo,
      timeEvents(await readEvents(repo, since), window, settings),
    );
  }
  return events;
}
