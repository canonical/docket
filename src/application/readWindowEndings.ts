import type { Duration } from "../lib/clock/index.js";
import {
  type FinishedThread,
  type TimedEnding,
  timeEndings,
} from "../lib/endings/index.js";
import findWindowStart from "./findWindowStart.js";
import type { Watched } from "./types.js";

/**
 * Reads the threads that finished in each watched repository from far
 * enough back that every ending inside the window of working time before
 * `now`, on that repository's own clock, is among them, and times each
 * against the window on that clock once, as activity's events are.
 *
 * @param readFinished Gives the threads of a repository that finished at
 * or after a time.
 * @returns Each repository's threads, timed, by its `owner/name`.
 * @note Impure: reads each watched repository through `readFinished`,
 * one repository at a time.
 */
export default async function readWindowEndings(
  readFinished: (
    repo: string,
    since: Date,
  ) => Promise<readonly FinishedThread[]>,
  watched: readonly Watched[],
  window: Duration,
  now: Date,
): Promise<ReadonlyMap<string, readonly TimedEnding[]>> {
  const endings = new Map<string, readonly TimedEnding[]>();
  for (const { repo, resolved } of watched) {
    const { settings } = resolved;
    const since = findWindowStart(window, settings, now);
    endings.set(
      repo,
      timeEndings(await readFinished(repo, since), window, settings),
    );
  }
  return endings;
}
