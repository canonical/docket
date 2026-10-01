import type { Budget } from "../provider/index.js";
import sanitize from "./sanitize.js";
import type { Freshness } from "./types.js";

/** A budget for a program, or `null` while none is known. */
const describeFigures = (budget: Budget | undefined) =>
  budget
    ? {
        remaining: budget.remaining,
        limit: budget.limit,
        resetAt: budget.resetAt.toISOString(),
      }
    : null;

/**
 * How old the data behind an answer is, for a program: when it was
 * synced, its age in whole seconds, any warning in force, and both of
 * GitHub's budgets, the queries' and the REST requests'.
 */
export default function describeDataAge({
  now,
  syncedAt,
  warnings,
  budget,
}: Freshness) {
  return {
    syncedAt: syncedAt?.toISOString() ?? null,
    ageSeconds: syncedAt
      ? Math.max(0, Math.floor((now.getTime() - syncedAt.getTime()) / 1000))
      : null,
    warnings: warnings.map(({ code, message, recovery }) => ({
      code,
      message: sanitize(message),
      recovery: sanitize(recovery),
    })),
    budget: {
      graphql: describeFigures(budget.graphql),
      rest: describeFigures(budget.rest),
    },
  };
}
