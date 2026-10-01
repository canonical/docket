import type { Budget, Budgets } from "../provider/index.js";
import { farthestReset } from "./constants.js";

/**
 * `budgets` without any report whose reset lies more than
 * `farthestReset` after `at`, which no answer of GitHub's gives: such a
 * report would otherwise win every merge and hold the floor for good.
 */
export default function dropFarResets(budgets: Budgets, at: Date): Budgets {
  const latest = at.getTime() + farthestReset;
  const { graphql, rest } = budgets;
  const isNear = (budget: Budget | undefined) =>
    budget !== undefined && budget.resetAt.getTime() <= latest;
  return {
    ...(isNear(graphql) && { graphql }),
    ...(isNear(rest) && { rest }),
  };
}
