import { mkdirSync, watch } from "node:fs";
import { join } from "node:path";
import type { Budgets } from "../provider/index.js";
import readBudgetReport from "./readBudgetReport.js";

/**
 * Watches the budget folder, and hands `adopt` what each budget file
 * another process writes tells at `now`: that one file, not the folder.
 * This process's own file, `own`, holds nothing it lacks, and a temporary
 * file is no budget file.
 *
 * @note Impure: creates the folder, watches it and reads its files.
 * @returns Stops watching.
 */
export default function watchBudgetFolder(
  folder: string,
  own: string,
  now: () => Date,
  adopt: (read: Budgets) => void,
): () => void {
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const watcher = watch(folder, (_event, name) => {
    if (!name?.endsWith(".json") || name === own) return;
    void readBudgetReport(join(folder, name), now()).then(adopt);
  });
  return () => watcher.close();
}
