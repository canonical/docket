import { refreshInterval } from "./constants.js";
import type { Cache } from "./types.js";

/**
 * Starts the refresh cycle of an open terminal interface: a refresh at
 * once, then another `refreshInterval` after each one ends, and a reload
 * whenever another process writes the cache. Text mode never starts it:
 * it reads once, with a maximum age.
 *
 * @note Impure: sets timers and watches the cache folder.
 * @returns Stops the cycle.
 */
export default function startRefreshCycle(
  cache: Pick<Cache, "refresh" | "watch">,
): () => void {
  const stopWatching = cache.watch();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    try {
      await cache.refresh();
    } finally {
      if (!stopped) timer = setTimeout(tick, refreshInterval);
    }
  };
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
    stopWatching();
  };
}
