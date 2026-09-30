import type { CacheStatus } from "../lib/cache/index.js";

/**
 * Whether the stages are an earlier run's: the status holds a failure,
 * not the rate limit's and not under a pause, that no repository's
 * `failed` stage names, so it stopped a refresh before any fetch.
 */
export default function findEarlierRun({
  failure,
  paused,
  stages,
}: CacheStatus): boolean {
  if (!failure || paused || failure.code === "GITHUB_RATE_LIMITED") {
    return false;
  }
  return !stages.some(
    ({ stage }) =>
      stage.kind === "failed" &&
      stage.error.code === failure.code &&
      stage.error.message === failure.message,
  );
}
