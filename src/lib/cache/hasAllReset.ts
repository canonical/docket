import type { Budget, Budgets } from "../provider/index.js";

/**
 * Whether `budgets` holds a report and every report it holds has reset by
 * `at`, so it tells nothing more: a file of such reports, as a process
 * that ended leaves it, is passed over and may be removed.
 */
export default function hasAllReset({ graphql, rest }: Budgets, at: Date) {
  const hasReset = (budget: Budget | undefined) =>
    budget === undefined || budget.resetAt <= at;
  return (graphql ?? rest) !== undefined && hasReset(graphql) && hasReset(rest);
}
