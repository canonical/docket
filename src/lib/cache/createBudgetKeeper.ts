import type { Budgets } from "../provider/index.js";
import isSame from "./isSame.js";
import writeBudgetFile from "./writeBudgetFile.js";

/** What keeping the budgets reads of the cache it serves. */
interface BudgetKeeperOptions {
  /** This process's own file in the budget folder. */
  readonly file: string;
  /** The budgets this process's own answers report. */
  readonly readOwn: () => Budgets;
  /** Gives the status the floor as the mirror stands. */
  readonly publishFloor: () => void;
}

/**
 * The keeping of the budgets this process heard in its own file of the
 * budget folder, so every docket process judges the floor on them. Only
 * this process writes that file, always whole, so no other process's
 * write can race it; each reader takes, of every file, the latest report
 * of each kind. The status says the floor at once. The file is written
 * only when what this process heard differs from what it last wrote, one
 * write after another, so a later write never lands before an earlier
 * one. The file outlives the process, so a later call judges the floor on
 * it, until its reports reset and a reader removes it. A reader may remove
 * it just as this process writes fresh figures, which are then missing
 * until a later answer changes them and is kept. Keeping never fails: a
 * write that fails is dropped, and the next keeping writes again.
 *
 * @note Impure: writes the status, and writes this process's budget file.
 */
export default function createBudgetKeeper({
  file,
  readOwn,
  publishFloor,
}: BudgetKeeperOptions): () => Promise<void> {
  let written: Budgets = {};
  const write = async () => {
    const own = readOwn();
    if (isSame(own, written)) return;
    await writeBudgetFile(file, own);
    written = own;
  };
  let writing = Promise.resolve();
  return () => {
    // This process's own answers can take the mirror below the floor.
    publishFloor();
    writing = writing.then(write).catch(() => undefined);
    return writing;
  };
}
