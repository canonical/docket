import type { CheckRefresh } from "../provider/index.js";
import type { Thread } from "../waits/index.js";

/**
 * Sets the checks read again on the pull requests they belong to. A pull
 * request whose head commit has no checks any more loses its checks.
 */
export default function applyChecks(
  threads: readonly Thread[],
  refreshed: readonly CheckRefresh[],
): Thread[] {
  const found = new Map(
    refreshed.map((refresh) => [`${refresh.repo}#${refresh.number}`, refresh]),
  );
  return threads.map((thread) => {
    const refresh =
      thread.kind === "pullRequest"
        ? found.get(`${thread.repo}#${thread.number}`)
        : undefined;
    if (!refresh) return thread;
    const { checks: _previous, ...rest } = thread;
    return refresh.checks ? { ...rest, checks: refresh.checks } : rest;
  });
}
