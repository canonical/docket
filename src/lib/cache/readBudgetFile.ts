import { readFile } from "node:fs/promises";
import type { Budget, Budgets } from "../provider/index.js";

/**
 * `value` as a budget, when it holds one whole: every figure a number,
 * and the reset a date that exists.
 */
function parseBudget(value: unknown): Budget | undefined {
  const { limit, remaining, resetAt } = (value ?? {}) as Record<
    string,
    unknown
  >;
  const isFigure = (figure: unknown): figure is number =>
    typeof figure === "number" && Number.isFinite(figure);
  const reset = typeof resetAt === "string" ? new Date(resetAt) : undefined;
  return isFigure(limit) &&
    isFigure(remaining) &&
    reset &&
    isFigure(reset.getTime())
    ? { limit, remaining, resetAt: reset }
    : undefined;
}

/**
 * Reads the budgets a process's budget file holds, each kind that is whole.
 *
 * @note Impure: reads the filesystem.
 * @returns No budget when there is no file yet, or it cannot be read or
 * is not JSON: nothing is known then, and the next answer tells.
 */
export default async function readBudgetFile(file: string): Promise<Budgets> {
  try {
    const { graphql, rest } = JSON.parse(await readFile(file, "utf8")) ?? {};
    const queries = parseBudget(graphql);
    const requests = parseBudget(rest);
    return {
      ...(queries && { graphql: queries }),
      ...(requests && { rest: requests }),
    };
  } catch {
    return {};
  }
}
