import { readFile } from "node:fs/promises";
import type { Budget, Budgets } from "../provider/index.js";
import { cacheFormat, dateTag } from "./constants.js";
import type { CacheFile } from "./types.js";

/** Reads `{ "$date": "<ISO 8601>" }` back as a date. */
function readDates(_key: string, value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const date = (value as Record<string, unknown>)[dateTag];
  return typeof date === "string" && Object.keys(value).length === 1
    ? new Date(date)
    : value;
}

/** `value` as a budget, when it holds one whole. */
function readBudget(value: unknown): Budget | undefined {
  const { limit, remaining, resetAt } = (value ?? {}) as Partial<Budget>;
  return typeof limit === "number" &&
    typeof remaining === "number" &&
    resetAt instanceof Date
    ? { limit, remaining, resetAt }
    : undefined;
}

/**
 * The budgets the file mirrors, each kind that is whole: another version
 * of docket may have written none.
 */
function readBudgets(value: unknown): Budgets {
  const { graphql, rest } = (value ?? {}) as Record<string, unknown>;
  const queries = readBudget(graphql);
  const requests = readBudget(rest);
  return {
    ...(queries && { graphql: queries }),
    ...(requests && { rest: requests }),
  };
}

/**
 * Reads the cache file that `writeCacheFile` wrote.
 *
 * @note Impure: reads the filesystem.
 * @returns Nothing when there is no file yet, or when it cannot be read,
 * is not JSON, or has another layout: the data is then fetched again.
 */
export default async function readCacheFile(
  file: string,
): Promise<CacheFile | undefined> {
  try {
    const { format, state, fullRefreshAt, budget } = JSON.parse(
      await readFile(file, "utf8"),
      readDates,
    );
    if (format !== cacheFormat) return undefined;
    return {
      state,
      fullRefreshAt: fullRefreshAt instanceof Date ? fullRefreshAt : undefined,
      budget: readBudgets(budget),
    };
  } catch {
    return undefined;
  }
}
