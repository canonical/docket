import withFetchLock from "./withFetchLock.js";

/** What keeping the budgets reads and writes of the cache it serves. */
export interface BudgetKeeperOptions {
  /** The cache folder, whose fetch lock guards the file. */
  readonly directory: string;
  /** Whether the file holds every figure this process heard, or later ones. */
  readonly isKept: () => boolean;
  /** Loads the cache file, merging its budgets into the mirror. */
  readonly load: () => Promise<void>;
  /** Writes the cache file, the mirror's budgets with it. */
  readonly save: () => Promise<void>;
  /** Gives the status the floor as the mirror stands. */
  readonly publishFloor: () => void;
}

/**
 * The keeping of the budgets a process heard outside a refresh in the
 * cache file, so every docket process judges the floor on them: the
 * status says the floor at once, and, when the file lacks any of them,
 * they are written under the fetch lock, after a load.
 *
 * @note Impure: writes the status, and reads and writes the cache file.
 */
export default function createBudgetKeeper({
  directory,
  isKept,
  load,
  save,
  publishFloor,
}: BudgetKeeperOptions): () => Promise<void> {
  return async () => {
    // This process's own answers can take the mirror below the floor.
    publishFloor();
    // With nothing heard since the last load or save, the file holds
    // these figures or later ones.
    if (isKept()) return;
    // While another process holds the lock, its save may write figures
    // older than this one's, so they wait for it to end, and a lower
    // figure is never lost to an older one.
    await withFetchLock(directory, async () => {
      await load();
      // Only figures the file lacks are worth a write every process
      // reloads.
      if (!isKept()) await save();
    });
  };
}
