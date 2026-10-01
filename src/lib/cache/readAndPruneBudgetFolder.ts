import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Budgets } from "../provider/index.js";
import { leftoverAge } from "./constants.js";
import dropFarResets from "./dropFarResets.js";
import hasAllReset from "./hasAllReset.js";
import mergeBudgets from "./mergeBudgets.js";
import readBudgetFile from "./readBudgetFile.js";

/**
 * The budgets every docket process's file in `folder` reports, as one: of
 * each kind, the latest report, as `mergeBudgets` judges it. A torn or
 * unreadable file is passed over, and so is a report that resets past
 * GitHub's window.
 *
 * A file whose reports have all reset by `at` tells nothing, and is
 * removed, so after a read the folder holds the files of the last hour's
 * processes alone. Its process may be alive and quiet, and write fresh figures just
 * as the file is removed: those figures are then missing until a later
 * answer of that process changes them and is kept, a window left open
 * rather than guarded.
 *
 * A temporary file older than `leftoverAge` was left by a process that
 * ended between a write and its rename, and is removed too.
 *
 * @note Impure: reads the filesystem, and removes files that tell nothing;
 * a file it cannot remove is left.
 * @returns No budget while the folder holds no file.
 */
export default async function readAndPruneBudgetFolder(
  folder: string,
  at: Date,
): Promise<Budgets> {
  const names = await readdir(folder).catch((): string[] => []);
  const files = names
    .filter((name) => name.endsWith(".json"))
    .map((name) => join(folder, name));
  const read = await Promise.all(files.map(readBudgetFile));
  const isSpent = (budgets: Budgets) => hasAllReset(budgets, at);
  const remove = (file: string) =>
    rm(file, { force: true }).catch(() => undefined);
  const isLeftOver = async (file: string) =>
    (await stat(file)).mtime.getTime() <= at.getTime() - leftoverAge;
  const temporaries = names
    .filter((name) => name.endsWith(".tmp"))
    .map((name) => join(folder, name));
  await Promise.all([
    ...files.map((file, index) =>
      isSpent(read[index] ?? {}) ? remove(file) : undefined,
    ),
    ...temporaries.map(async (file) =>
      (await isLeftOver(file).catch(() => false)) ? remove(file) : undefined,
    ),
  ]);
  return read
    .filter((budgets) => !isSpent(budgets))
    .map((budgets) => dropFarResets(budgets, at))
    .reduce(mergeBudgets, {});
}
