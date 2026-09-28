import type { CachedThreads } from "../lib/cache/index.js";
import type { Problem } from "../lib/text/index.js";
import isNamedError from "./isNamedError.js";
import type { Session } from "./types.js";

/** The threads a command answers from, and what kept them from being newer. */
export interface ReadThreads extends CachedThreads {
  readonly warnings: readonly Problem[];
}

/**
 * Reads the threads through the shared cache, no older than the call's
 * maximum age. When GitHub or the cache fails and every repository still
 * has cached data, that data answers with the failure as a warning, such
 * as a rate limit: an agent still gets an answer, and learns its age.
 *
 * @throws Error the failure, when some repository has no data at all, or
 * when gh itself is not ready, which no cached data fixes.
 *
 * @note Impure: reads the cache, which asks GitHub when its data is
 * too old.
 */
export default async function readThreads({
  cache,
  invocation,
}: Session): Promise<ReadThreads> {
  try {
    return { ...(await cache.read(invocation.maxAge)), warnings: [] };
  } catch (error) {
    const held = cache.threads();
    if (
      !isNamedError(error) ||
      error.code.startsWith("GH_") ||
      !held.syncedAt
    ) {
      throw error;
    }
    const { code, message, recovery } = error;
    return { ...held, warnings: [{ code, message, recovery }] };
  }
}
