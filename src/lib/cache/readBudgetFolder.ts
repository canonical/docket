import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Budget, Budgets } from "../provider/index.js";
import dropFarResets from "./dropFarResets.js";
import mergeBudgets from "./mergeBudgets.js";
import readBudgetFile from "./readBudgetFile.js";

/**
 * The budgets every docket process's file in `folder` reports, as one: of
 * each kind, the latest report, as `mergeBudgets` judges it. A torn or
 * unreadable file is passed over, and so is a report that resets past
 * GitHub's window.
 *
 * A file whose reports have all reset by `at` tells nothing, and is
 * removed, so the folder holds no more than the processes of the last
 * hour. Its process may be alive and quiet, and write fresh figures just
 * as the file is removed: those figures are then missing until a later
 * answer of that process changes them and is kept, a window left open
 * rather than guarded.
 *
 * @note Impure: reads the filesystem, and removes files that tell nothing;
 * a file it cannot remove is left.
 * @returns No budget while the folder holds no file.
 */
export default async function readBudgetFolder(
  folder: string,
  at: Date,
): Promise<Budgets> {
  const names = await readdir(folder).catch((): string[] => []);
  const files = names
    .filter((name) => name.endsWith(".json"))
    .map((name) => join(folder, name));
  const read = await Promise.all(files.map(readBudgetFile));
  const hasReset = (budget: Budget | undefined) =>
    budget === undefined || budget.resetAt <= at;
  const isSpent = ({ graphql, rest }: Budgets) =>
    (graphql ?? rest) !== undefined && hasReset(graphql) && hasReset(rest);
  await Promise.all(
    files.map((file, index) =>
      isSpent(read[index] ?? {})
        ? rm(file, { force: true }).catch(() => undefined)
        : undefined,
    ),
  );
  return read
    .filter((budgets) => !isSpent(budgets))
    .map((budgets) => dropFarResets(budgets, at))
    .reduce(mergeBudgets, {});
}
