import type { CacheStatus } from "../lib/cache/index.js";
import { describeClock } from "../lib/ui/index.js";

/** Why the list waits, and what to do about it. */
export interface Hold {
  /** A sentence, from a failure's message, or a line. */
  readonly reason: string;
  readonly recovery: string;
}

/**
 * Why the first fetch cannot go on, and what to do about it, or nothing
 * while a refresh runs or none has stopped. The reasons come in the order
 * the status line names them: a rate limit, what stopped the last
 * refresh, then a pause to spare the request budget. A pause stops the
 * refresh without a failure, so without this the list would say
 * `refresh in progress…` until it resumes. The screen asks only while no
 * repository has a stage, as when the refresh stopped before it fetched
 * any: once each has one, its line says where the refresh stands.
 *
 * @param timezone The time zone the time the refresh resumes is written in.
 */
export default function describeHold(
  status: CacheStatus,
  timezone: string,
): Hold | undefined {
  const { refreshing, paused, failure } = status;
  if (refreshing) return undefined;
  const resume = (until: Date) =>
    `wait: docket resumes at ${describeClock(until, timezone)}`;
  if (paused?.reason === "rateLimit") {
    const reason = "GitHub refused requests for its rate limit";
    return { reason, recovery: resume(paused.until) };
  }
  if (failure) return { reason: failure.message, recovery: failure.recovery };
  if (paused) {
    const reason = "docket paused the refresh to spare the request budget";
    return { reason, recovery: resume(paused.until) };
  }
  return undefined;
}
