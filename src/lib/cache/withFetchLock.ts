import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { lock } from "proper-lockfile";
import CacheError from "./CacheError.js";
import { lockName, lockTiming } from "./constants.js";
import identifyFile from "./identifyFile.js";

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
 * never given up: it belongs to the process that took it.
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
    let lost = false;
    const forgotten = Promise.withResolvers<void>();
    const release = await lock(directory, {
      ...lockTiming,
      lockfilePath,
      onCompromised: () => {
        lost = true;
        forgotten.resolve();
      },
    }).catch(describeWait);
    const held = await identifyFile(lockfilePath);
    let outcome: { readonly value: T } | { readonly error: unknown };
    try {
      outcome = { value: await task() };
    } catch (error) {
      outcome = { error };
    }
    // The library hears that its lock was taken only when its next touch
    // of the lock comes due, which a process that stalled runs late, and
    // it gives up whatever lock it finds. The lock in the folder says at
    // once whether it is still this one.
    if ((await identifyFile(lockfilePath)) !== held) lost = true;
    // Until that touch, the library still counts a lost lock as this
    // process's, and removes it when the process exits: the lock of the
    // process that took it over. A failed task can end the process, so the
    // library is let forget the lock first, which it does within one
    // `update`, since the lock it touches is gone or another's.
    if (lost) await forgotten.promise;
    else await release();
    if ("error" in outcome) throw outcome.error;
    if (!lost) return outcome.value;
  }
}
