import type { Budgets } from "../provider/index.js";
import nameRefreshFailure from "./nameRefreshFailure.js";
import type { CacheStatus } from "./types.js";

/**
 * What the status keeps of what stopped a refresh: the failure as
 * `nameRefreshFailure` names it. A refusal for the rate limit pauses the
 * cycle until the budget resets instead, when `budgets` say when that
 * is: the one spent to nothing, else the queries' budget.
 */
export default function classifyRefreshFailure(
  thrown: unknown,
  { graphql, rest }: Budgets,
): Partial<CacheStatus> {
  const error = nameRefreshFailure(thrown);
  if (error.code === "GITHUB_RATE_LIMITED") {
    const spent = [graphql, rest].find((budget) => budget?.remaining === 0);
    const until = (spent ?? graphql)?.resetAt;
    if (until) return { paused: { until, reason: "rateLimit" } } as const;
  }
  return { failure: error };
}
