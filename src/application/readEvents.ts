import type { CachedEvents } from "../lib/cache/index.js";
import type { Problem } from "../lib/text/index.js";
import describeFailure from "./describeFailure.js";
import isNamedError from "./isNamedError.js";
import type { Session } from "./types.js";

/** The events of one repository, and what kept them from being newer. */
export interface ReadEvents extends CachedEvents {
  readonly warnings: readonly Problem[];
}

/**
 * Reads the events of `repo` at or after `since` through the shared
 * cache, no older than the call's maximum age. When GitHub or the cache
 * fails and the cache holds events reaching back to `since`, those answer
 * with the failure as a warning, such as a rate limit: an agent still
 * gets an answer, and learns its age.
 *
 * @throws Error the failure, when no events held reach back to `since`,
 * or when gh itself is not ready, which no cached data fixes.
 * @note Impure: reads the cache, which asks GitHub when its events are
 * too old.
 */
export default async function readEvents(
  { cache, invocation }: Session,
  repo: string,
  since: Date,
): Promise<ReadEvents> {
  try {
    const read = await cache.readEvents(repo, since, invocation.maxAge);
    return { ...read, warnings: [] };
  } catch (error) {
    const held = cache.findEvents(repo, since);
    if (!isNamedError(error) || error.code.startsWith("GH_") || !held) {
      throw error;
    }
    return { ...held, warnings: [describeFailure(error)] };
  }
}
