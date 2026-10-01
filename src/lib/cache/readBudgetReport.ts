import type { Budgets } from "../provider/index.js";
import dropFarResets from "./dropFarResets.js";
import hasAllReset from "./hasAllReset.js";
import readBudgetFile from "./readBudgetFile.js";

/**
 * What one process's budget file tells at `at`: nothing when it is torn
 * or unreadable, or when its reports have all reset, and otherwise its
 * reports, less any that resets past GitHub's window.
 *
 * @note Impure: reads the filesystem.
 */
export default async function readBudgetReport(
  file: string,
  at: Date,
): Promise<Budgets> {
  const read = await readBudgetFile(file);
  return hasAllReset(read, at) ? {} : dropFarResets(read, at);
}
