/*
 * What the fetch lock guarantees:
 * - at most one docket process fetches at a time;
 * - a lock another process owns is never deleted;
 * - nothing waits without end: every wait has a bound;
 * - no lock this process adopted is left behind.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { lock } from "proper-lockfile";
import CacheError from "./CacheError.js";
import { lockName, lockTiming } from "./constants.js";
import holdLock from "./holdLock.js";

/** Turns a wait for the lock that ran out into a `CacheError`. */
const describeWait = (error: unknown): never => {
  if ((error as { code?: unknown }).code !== "ELOCKED") throw error;
  throw new CacheError(
    "CACHE_LOCK_TIMED_OUT",
    `Another docket process kept fetching for more than ${lockTiming.retries.maxRetryTime / 1000} seconds.`,
    "try again once the other docket process has fetched, or close it",
  );
};

/**
 * Runs `task` while holding the fetch lock of the cache folder, so only
 * one docket process fetches at a time. Neither TanStack Query nor Octokit
 * coordinates separate processes; this lock does.
 *
 * When the lock is lost while `task` runs, to a process that judged it
 * abandoned, `task`'s result is dropped and it runs again under the lock
 * taken anew: `task` reads the cache first, so it finds the other
 * process's data and fetches only if that is still needed. A lost lock is
 * let go only as `holdLock` lets one go.
 *
 * @note Impure: creates the folder and the lock in the filesystem.
 * @throws CacheError `CACHE_LOCK_TIMED_OUT` when another process holds the
 * lock for longer than `lockTiming` waits.
 */
export default async function withFetchLock<T>(
  directory: string,
  task: () => Promise<T>,
): Promise<T> {
  // The lock library resolves the real path of what it locks, which
  // therefore exists first.
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const lockfilePath = join(directory, lockName);
  for (;;) {
    const { lost, value } = await holdLock(
      (onCompromised) =>
        lock(directory, { ...lockTiming, lockfilePath, onCompromised }).catch(
          describeWait,
        ),
      lockfilePath,
      lockTiming.stale,
      task,
    );
    if (!lost) return value;
  }
}
