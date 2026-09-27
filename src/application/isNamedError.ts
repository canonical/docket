import type { Problem } from "../lib/text/index.js";

/**
 * Whether `error` is one a user can meet, with a named code and a
 * recovery: a provider's, the cache's, or docket's own.
 */
export default function isNamedError(error: unknown): error is Error & Problem {
  return (
    error instanceof Error &&
    typeof (error as Partial<Problem>).code === "string" &&
    typeof (error as Partial<Problem>).recovery === "string"
  );
}
