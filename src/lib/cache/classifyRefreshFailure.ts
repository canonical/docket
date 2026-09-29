import type { Provider, ProviderError } from "../provider/index.js";
import CacheError from "./CacheError.js";
import type { CacheStatus } from "./types.js";

/**
 * Whether `error` is one a user can meet, from the provider or the cache
 * itself, with its code and recovery.
 */
const isNamedError = (error: unknown): error is ProviderError | CacheError =>
  error instanceof Error &&
  typeof (error as Partial<ProviderError>).code === "string" &&
  typeof (error as Partial<ProviderError>).recovery === "string";

/**
 * What the status keeps of what stopped a refresh: a provider error or the
 * cache's own as it is, and any other, such as a full disk or an answer
 * cut short, as `CACHE_REFRESH_FAILED`. That code covers causes that
 * need different steps, so it names the cause and gives a step that
 * holds for each. The message ends as a sentence, as every message
 * does: a full stop follows a cause that ends in none of `.`, `?` or
 * `!`, and a cause with no text leaves the message's own sentence
 * alone. A refusal for the rate limit pauses the cycle until the budget
 * resets, when the provider can say when that is.
 *
 * @note Impure: asks the provider for its budget after a rate limit.
 */
export default async function classifyRefreshFailure(
  thrown: unknown,
  provider: Pick<Provider, "budget">,
): Promise<Partial<CacheStatus>> {
  const cause = thrown instanceof Error ? thrown.message : String(thrown);
  const error = isNamedError(thrown)
    ? thrown
    : new CacheError(
        "CACHE_REFRESH_FAILED",
        cause === ""
          ? "docket could not refresh its cache."
          : `docket could not refresh its cache: ${/[.?!]$/.test(cause) ? cause : `${cause}.`}`,
        "refresh again",
      );
  if (error.code === "GITHUB_RATE_LIMITED") {
    const until = await provider.budget().then(
      ({ resetAt }) => resetAt,
      () => undefined,
    );
    if (until) return { paused: { until, reason: "rateLimit" } } as const;
  }
  return { failure: error };
}
