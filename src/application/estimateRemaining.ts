import type { PageProgress } from "../lib/provider/index.js";

/**
 * A rough estimate of the time left reading `progress`, from how long the
 * pages so far took: `~42s left`, or `~2m left`. It stays unstated before
 * a second or a complete page, when the rate is too rough to mean much.
 */
export default function estimateRemaining(
  progress: PageProgress,
  startedAt: Date,
  now: Date,
): string | undefined {
  const elapsed = now.getTime() - startedAt.getTime();
  const left = progress.total - progress.fetched;
  if (elapsed < 1_000 || progress.fetched === 0 || left <= 0) return undefined;
  const seconds = Math.ceil(((elapsed / progress.fetched) * left) / 1_000);
  return seconds < 60
    ? `~${seconds}s left`
    : `~${Math.ceil(seconds / 60)}m left`;
}
