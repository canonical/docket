import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Budgets } from "../provider/index.js";

/**
 * Writes the budget file whole: into a temporary file beside it, then
 * renamed over it, so a reader meets the old budgets or the new ones and
 * never half of them. Each reset is written in ISO 8601. The file is
 * readable by its owner alone, in a folder only its owner can enter.
 *
 * @note Impure: writes the filesystem.
 */
export default async function writeBudgetFile(
  file: string,
  budgets: Budgets,
): Promise<void> {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(budgets), { mode: 0o600 });
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
