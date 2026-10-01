import type { Budget } from "../provider/index.js";
import { budgetFloor } from "./constants.js";

/**
 * Until when the refresh cycle spends no points, or `undefined` while it
 * may: when less than `budgetFloor` of `budget` remains at `at`, the rest
 * is left to the user's own requests until the budget resets. With no
 * budget known, nothing says it is low.
 */
export default function findBudgetFloor(
  budget: Budget | undefined,
  at: Date,
): { readonly until: Date; readonly reason: "budget" } | undefined {
  if (!budget) return undefined;
  const { limit, remaining, resetAt } = budget;
  return at < resetAt && remaining < limit * budgetFloor
    ? { until: resetAt, reason: "budget" }
    : undefined;
}
