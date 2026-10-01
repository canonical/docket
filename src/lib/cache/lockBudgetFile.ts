import { lock } from "proper-lockfile";
import { budgetLockTiming } from "./constants.js";

/**
 * Takes the budget file's own lock, at `lockfilePath`, as `budgetLockTiming`
 * says: trying again only while another process holds it, and failing at
 * once on any other failure, such as a folder it cannot write. The file
 * need not exist: the lock takes its path as it is.
 *
 * @note Impure: makes the lock in the filesystem, and waits.
 * @param onCompromised Hears that another process took the lock over.
 * @returns Lets the lock go.
 * @throws Error `ELOCKED` once the wait is over, or the failure to take it.
 */
export default async function lockBudgetFile(
  file: string,
  lockfilePath: string,
  onCompromised: () => void,
): Promise<() => Promise<void>> {
  const { stale, update, firstWait, longestWait, wait } = budgetLockTiming;
  let delay: number = firstWait;
  let waited = 0;
  for (;;) {
    try {
      return await lock(file, {
        stale,
        update,
        realpath: false,
        lockfilePath,
        onCompromised,
      });
    } catch (error) {
      const held = (error as { code?: unknown }).code === "ELOCKED";
      if (!held || waited >= wait) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    waited += delay;
    delay = Math.min(delay * 2, longestWait);
  }
}
