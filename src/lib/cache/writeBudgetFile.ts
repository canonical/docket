import type { Budgets } from "../provider/index.js";
import writeWhole from "./writeWhole.js";

/**
 * Writes the budget file whole, as `writeWhole` writes, so a reader meets
 * the old budgets or the new ones and never half of them. Each reset is
 * written in ISO 8601.
 *
 * @note Impure: writes the filesystem.
 */
export default function writeBudgetFile(
  file: string,
  budgets: Budgets,
): Promise<void> {
  return writeWhole(file, JSON.stringify(budgets));
}
