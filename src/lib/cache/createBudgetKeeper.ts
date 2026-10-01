import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Budgets } from "../provider/index.js";
import { budgetLockTiming } from "./constants.js";
import dropFarResets from "./dropFarResets.js";
import identifyFile from "./identifyFile.js";
import isSame from "./isSame.js";
import lockBudgetFile from "./lockBudgetFile.js";
import mergeBudgets from "./mergeBudgets.js";
import readBudgetFile from "./readBudgetFile.js";
import writeBudgetFile from "./writeBudgetFile.js";

/** What keeping the budgets reads and writes of the cache it serves. */
interface BudgetKeeperOptions {
  /** The budget file, beside the cache file. */
  readonly file: string;
  /** The budget file's own lock, beside it. */
  readonly lockPath: string;
  /** The budgets the file last gave this process, its own answers joined. */
  readonly readFigures: () => Budgets;
  /**
   * Whether this process heard nothing since it last read or wrote the
   * file: its mirror holds every figure its answers gave.
   */
  readonly isKept: () => boolean;
  /** Takes what the file holds once the keeping has written it. */
  readonly adopt: (kept: Budgets) => void;
  /** Gives the status the floor as the mirror stands. */
  readonly publishFloor: () => void;
  /** The cache's current time, which a reset in the file is judged by. */
  readonly now: () => Date;
}

/**
 * The keeping of the budgets a process heard in the budget file, so every
 * docket process judges the floor on them. The status says the floor at
 * once. When the file lacks any of the figures, they are merged into it
 * under the file's own lock, which is held only to read, merge and write
 * it: of each kind the later report stays, so an older figure never
 * overwrites a newer one, and the fetch lock plays no part. One keeping
 * runs at a time: a call made while one runs joins it, and it runs once
 * more for the figures heard meanwhile. It never fails: a keeping that
 * cannot read, lock or write the file is dropped, its lock let go, and the
 * next keeping carries the figures.
 *
 * @note Impure: writes the status, and reads, locks and writes the budget
 * file.
 */
export default function createBudgetKeeper({
  file,
  lockPath,
  readFigures,
  isKept,
  adopt,
  publishFloor,
  now,
}: BudgetKeeperOptions): () => Promise<void> {
  const keep = async () => {
    // With nothing heard since this process last read or wrote the file,
    // there is nothing to keep.
    if (isKept()) return;
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    const forgotten = Promise.withResolvers<void>();
    // The library tells when another process took the lock over, which
    // then belongs to that process.
    const release = await lockBudgetFile(file, lockPath, () =>
      forgotten.resolve(),
    );
    const own = await identifyFile(lockPath);
    let taken = false;
    try {
      // A report no answer of GitHub's gives is dropped, and written away.
      const read = await readBudgetFile(file);
      const held = dropFarResets(read, now());
      const kept = mergeBudgets(held, readFigures());
      // Another process that took the lock over may have written a later
      // figure since the read, which nothing here overwrites.
      taken = (await identifyFile(lockPath)) !== own;
      if (taken) return;
      if (!isSame(kept, read)) await writeBudgetFile(file, kept);
      adopt(kept);
    } finally {
      // The lock may also have been taken over since the check before the
      // write. A lock taken over is let go only once the library has heard
      // so, or its release would remove the lock of the process that took
      // it.
      taken ||= (await identifyFile(lockPath)) !== own;
      if (taken) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          forgotten.promise,
          new Promise((resolve) => {
            timer = setTimeout(resolve, budgetLockTiming.stale);
          }),
        ]);
        clearTimeout(timer);
      }
      await release().catch(() => undefined);
    }
  };
  // The keeping under way, which a call made meanwhile joins, and whether
  // one did, which keeps the figures heard since once it ends.
  let flight: Promise<void> | undefined;
  let again = false;
  return () => {
    // This process's own answers can take the mirror below the floor.
    publishFloor();
    if (flight) {
      again = true;
      return flight;
    }
    flight = (async () => {
      try {
        do {
          again = false;
          // Keeping is best effort: a failure is dropped, and the next
          // keeping carries the figures.
          await keep().catch(() => undefined);
        } while (again);
      } finally {
        flight = undefined;
      }
    })();
    return flight;
  };
}
