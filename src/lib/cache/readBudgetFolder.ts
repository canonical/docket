import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Budget, Budgets } from "../provider/index.js";
import dropFarResets from "./dropFarResets.js";
import mergeBudgets from "./mergeBudgets.js";
import readBudgetFile from "./readBudgetFile.js";

/**
 * The budgets every docket process's file in `folder` reports, as one: of
 * each kind, the latest report, as `mergeBudgets` judges it. A file whose
 * reports have all reset by `at`, as a process that died leaves it, tells
 * nothing and is passed over; so is one torn or unreadable, and a report
 * that resets past GitHub's window.
 *
 * @note Impure: reads the filesystem.
 * @returns No budget while the folder holds no file.
 */
export default async function readBudgetFolder(
  folder: string,
  at: Date,
): Promise<Budgets> {
  const names = await readdir(folder).catch((): string[] => []);
  const files = names.filter((name) => name.endsWith(".json"));
  const read = await Promise.all(
    files.map((name) => readBudgetFile(join(folder, name))),
  );
  const isLive = (budget: Budget | undefined) =>
    budget !== undefined && budget.resetAt > at;
  return read
    .map((budgets) => dropFarResets(budgets, at))
    .filter(({ graphql, rest }) => isLive(graphql) || isLive(rest))
    .reduce(mergeBudgets, {});
}
