/** The file, in the cache folder, that holds every repository's snapshot. */
export const cacheFileName = "snapshots.json";

/**
 * The layout of the cache file. A file written in another layout, by
 * another version of docket, is ignored and fetched again.
 */
export const cacheFormat = 1;

/**
 * How a date is written in the cache file: `{ "$date": "<ISO 8601>" }`.
 * Text from GitHub is always a JSON string, never an object, so no title
 * or comment can pass for a date.
 */
export const dateTag = "$date";

/** The lock, in the cache folder, that the one fetching process holds. */
export const lockName = "fetch.lock";

/**
 * How the fetch lock is held and waited for, in milliseconds. The holder
 * touches the lock every `update`, so it hears within a second when
 * another process took the lock from it; a lock untouched for `stale` is
 * left by a process that died, and is taken over. A process waits for the
 * lock for as long as a live holder keeps it, retrying between
 * `minTimeout` and `maxTimeout` apart, because the holder is fetching the
 * data the waiter wants.
 */
export const lockTiming = {
  stale: 10_000,
  update: 1_000,
  retries: { forever: true, minTimeout: 100, maxTimeout: 1_000 },
} as const;

/**
 * How long, in milliseconds, cached data serves a reader that names no
 * maximum age, so an agent asking in a loop causes at most one refresh
 * every five minutes.
 */
export const defaultMaxAge = 300_000;

/**
 * How often, in milliseconds, a repository is fetched whole rather than
 * since its cursor. No snapshot since a cursor reports a thread that was
 * deleted or moved to another repository; fetching everything drops it.
 */
export const reconcileInterval = 3_600_000;
