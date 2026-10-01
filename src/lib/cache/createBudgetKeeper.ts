import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Budgets } from "../provider/index.js";
import { budgetLockTiming } from "./constants.js";
import dropFarResets from "./dropFarResets.js";
import holdLock from "./holdLock.js";
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
  readonly lockfilePath: string;
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
 * once. When this process heard anything since it last read or wrote the
 * file, the figures are merged into it under the file's own lock, which is
 * held only to read, merge and write it: of each kind the later report
 * stays, so a merge never trades a newer figure for an older one, and the
 * fetch lock plays no part. The lock is held and let go as `holdLock`
 * holds every docket lock, and checked to be still this keeping's before
 * the write: a keeping whose lock another process took over before that
 * check writes nothing. Two narrow windows remain: a takeover between the
 * check and the end of the write, whose older merge may then replace a
 * later figure the other process wrote; and one between the last check
 * and the letting go, which removes the other process's lock. One keeping runs at a time: a call made while one runs joins it,
 * and it runs once more for the figures heard meanwhile. It never fails: a
 * keeping that cannot read, lock or write the file, or let go of its lock,
 * is dropped; the process's next keeping, if it keeps again, carries the
 * figures.
 *
 * @note Impure: writes the status, and reads, locks and writes the budget
 * file.
 */
export default function createBudgetKeeper({
  file,
  lockfilePath,
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
    await holdLock(
      (onCompromised) => lockBudgetFile(file, lockfilePath, onCompromised),
      lockfilePath,
      budgetLockTiming.stale,
      async (isOwn) => {
        // A report no answer of GitHub's gives is dropped, and written
        // away.
        const read = await readBudgetFile(file);
        const held = dropFarResets(read, now());
        const kept = mergeBudgets(held, readFigures());
        // A process that took the lock over may have written a later figure
        // since the read, which nothing here overwrites.
        if (!(await isOwn())) return;
        if (!isSame(kept, read)) await writeBudgetFile(file, kept);
        adopt(kept);
      },
    );
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
          // Keeping is best effort: a failure is dropped, and its figures
          // are lost unless this process keeps again.
          await keep().catch(() => undefined);
        } while (again);
      } finally {
        flight = undefined;
      }
    })();
    return flight;
  };
}
