import type { ProviderError } from "../provider/index.js";
import CacheError from "./CacheError.js";

/**
 * Whether `error` is one a user can meet, from the provider or the cache
 * itself, with its code and recovery.
 */
const isNamedError = (error: unknown): error is ProviderError | CacheError =>
  error instanceof Error &&
  typeof (error as Partial<ProviderError>).code === "string" &&
  typeof (error as Partial<ProviderError>).recovery === "string";

/**
 * What stopped a refresh, as a user meets it: a provider error or the
 * cache's own as it is, and any other, such as a full disk or an answer
 * cut short, as `CACHE_REFRESH_FAILED`. That code covers causes that
 * need different steps, so it names the cause and gives a step that
 * holds for each. The message ends as a sentence, as every message
 * does: a full stop follows a cause that ends in none of `.`, `?` or
 * `!`, and a cause with no text leaves the message's own sentence
 * alone.
 */
export default function nameRefreshFailure(
  thrown: unknown,
): ProviderError | CacheError {
  if (isNamedError(thrown)) return thrown;
  const cause = thrown instanceof Error ? thrown.message : String(thrown);
  return new CacheError(
    "CACHE_REFRESH_FAILED",
    cause === ""
      ? "docket could not refresh its cache."
      : `docket could not refresh its cache: ${/[.?!]$/.test(cause) ? cause : `${cause}.`}`,
    "refresh again",
  );
}
