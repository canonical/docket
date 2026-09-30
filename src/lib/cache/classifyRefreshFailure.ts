import type { Provider } from "../provider/index.js";
import nameRefreshFailure from "./nameRefreshFailure.js";
import type { CacheStatus } from "./types.js";

/**
 * What the status keeps of what stopped a refresh: the failure as
 * `nameRefreshFailure` names it. A refusal for the rate limit pauses the
 * cycle until the budget resets instead, when the provider can say when
 * that is.
 *
 * @note Impure: asks the provider for its budget after a rate limit.
 */
export default async function classifyRefreshFailure(
  thrown: unknown,
  provider: Pick<Provider, "budget">,
): Promise<Partial<CacheStatus>> {
  const error = nameRefreshFailure(thrown);
  if (error.code === "GITHUB_RATE_LIMITED") {
    const until = await provider.budget().then(
      ({ resetAt }) => resetAt,
      () => undefined,
    );
    if (until) return { paused: { until, reason: "rateLimit" } } as const;
  }
  return { failure: error };
}
