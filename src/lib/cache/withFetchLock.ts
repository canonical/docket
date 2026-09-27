import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { lock } from "proper-lockfile";
import { lockName, lockTiming } from "./constants.js";

/**
 * Runs `task` while holding the fetch lock of the cache folder, so only
 * one docket process fetches at a time. Neither TanStack Query nor Octokit
 * coordinates separate processes; this lock does.
 *
 * When the lock is lost while `task` runs, to a process that judged it
 * abandoned, `task`'s result is dropped and it runs again under the lock
 * taken anew: `task` reads the cache first, so it finds the other
 * process's data and fetches only if that is still needed.
 *
 * @note Impure: creates the folder and the lock in the filesystem.
 */
export default async function withFetchLock<T>(
  directory: string,
  task: () => Promise<T>,
): Promise<T> {
  // The lock library resolves the real path of what it locks, which
  // therefore exists first.
  await mkdir(directory, { recursive: true, mode: 0o700 });
  for (;;) {
    let lost = false;
    const release = await lock(directory, {
      ...lockTiming,
      lockfilePath: join(directory, lockName),
      onCompromised: () => {
        lost = true;
      },
    });
    try {
      const result = await task();
      if (!lost) return result;
    } finally {
      if (!lost) await release();
    }
  }
}
