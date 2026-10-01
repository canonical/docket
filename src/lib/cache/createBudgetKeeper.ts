import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { lock } from "proper-lockfile";
import type { Budgets } from "../provider/index.js";
import { budgetLockTiming } from "./constants.js";
import identifyFile from "./identifyFile.js";
import isSame from "./isSame.js";
import mergeBudgets from "./mergeBudgets.js";
import readBudgetFile from "./readBudgetFile.js";
import writeBudgetFile from "./writeBudgetFile.js";

/** What keeping the budgets reads and writes of the cache it serves. */
interface BudgetKeeperOptions {
  /** The budget file, beside the cache file. */
  readonly file: string;
  /** The budgets the file last gave this process, its own answers joined. */
  readonly readFigures: () => Budgets;
  /** Whether the file holds every figure this process heard, or later ones. */
  readonly isKept: () => boolean;
  /** Takes what the file holds once the keeping has written it. */
  readonly adopt: (kept: Budgets) => void;
  /** Gives the status the floor as the mirror stands. */
  readonly publishFloor: () => void;
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
  readFigures,
  isKept,
  adopt,
  publishFloor,
}: BudgetKeeperOptions): () => Promise<void> {
  const keep = async () => {
    // With nothing heard since the file was last read or written, it holds
    // these figures or later ones.
    if (isKept()) return;
    // The lock resolves the real path of the file it locks, which
    // therefore exists first; one that exists is left as it is.
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, "{}", { flag: "wx", mode: 0o600 }).catch(
      () => undefined,
    );
    const lockPath = `${file}.lock`;
    const forgotten = Promise.withResolvers<void>();
    const release = await lock(file, {
      ...budgetLockTiming,
      // The library tells when another process took the lock over, which
      // then belongs to that process.
      onCompromised: () => forgotten.resolve(),
    });
    const own = await identifyFile(lockPath);
    let taken = false;
    try {
      const held = await readBudgetFile(file);
      const kept = mergeBudgets(held, readFigures());
      // Another process that took the lock over may have written a later
      // figure since the read, which nothing here overwrites.
      taken = (await identifyFile(lockPath)) !== own;
      if (taken) return;
      if (!isSame(kept, held)) await writeBudgetFile(file, kept);
      adopt(kept);
    } finally {
      // A lock taken over is let go only once the library has heard so,
      // or its release would remove the lock of the process that took it.
      if (taken) {
        await Promise.race([
          forgotten.promise,
          new Promise((resolve) =>
            setTimeout(resolve, budgetLockTiming.stale).unref(),
          ),
        ]);
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
