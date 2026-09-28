import { useEffect } from "react";
import type { AttentionState, Cache } from "../lib/cache/index.js";
import type { ThreadSummary } from "../lib/waits/index.js";
import { selectedThreadInterval } from "./constants.js";
import identifyThread from "./identifyThread.js";

/** Props for the useSelectedWatch hook. */
export interface UseSelectedWatchProps {
  /** The cache the repository is refreshed through, if there is one. */
  readonly cache: Pick<Cache, "refreshIfChanged"> | undefined;
  /** The selected thread, if any. */
  readonly selected: Pick<ThreadSummary, "repo" | "number"> | undefined;
  /** The pane's attention: only an active pane watches. */
  readonly attention: AttentionState;
}

/**
 * Keeps the selected thread current while the pane is active: every
 * `selectedThreadInterval` it stays selected, its repository gets the
 * free check for changes, and the threads changed are fetched only when
 * the check sees a change. A thread fetched again carries the time GitHub
 * last changed it, and a new one reads the accordion's details again
 * through the details held, as any refresh does. Moving the selection starts the
 * interval over, and an idle pane stops it. What stops one check is left
 * for the next, and the refresh cycle names it in the status.
 *
 * @note Impure: sets a timer, and refreshes through the cache.
 */
export default function useSelectedWatch({
  cache,
  selected,
  attention,
}: UseSelectedWatchProps): void {
  const key = selected && identifyThread(selected);
  const repo = selected?.repo;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new selection, even in the same repository, starts the interval over.
  useEffect(() => {
    if (!cache || !repo || attention !== "active") return;
    const timer = setInterval(() => {
      cache.refreshIfChanged(repo).catch(() => {});
    }, selectedThreadInterval);
    return () => clearInterval(timer);
  }, [cache, repo, key, attention]);
}
