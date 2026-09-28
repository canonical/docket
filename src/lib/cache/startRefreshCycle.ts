import { idleInterval, refreshInterval } from "./constants.js";
import type { Attention, Cache } from "./types.js";

/**
 * Starts the refresh cycle of an open terminal interface: a refresh at
 * once, then another `refreshInterval` after each one ends, or
 * `idleInterval` while the pane is idle, each run as the pane's attention
 * then sets it; and a reload whenever another process writes the cache,
 * idle or not. A key that wakes an idle pane runs a refresh at once, or
 * as soon as the one under way ends, and settles the pane active once it
 * has. A refresh keeps whatever stops it in the cache's status, so the
 * next one still comes. Text mode never starts it: it reads once, with a
 * maximum age.
 *
 * @note Impure: sets timers and watches the cache folder.
 * @returns Stops the cycle.
 */
export default function startRefreshCycle(
  cache: Pick<Cache, "refresh" | "watch">,
  attention: Pick<Attention, "state" | "settle" | "subscribe">,
): () => void {
  const stopWatching = cache.watch();
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    clearTimeout(timer);
    running = true;
    const state = attention.state();
    try {
      await cache.refresh(state);
    } finally {
      running = false;
      if (state === "waking") attention.settle();
      if (!stopped) {
        // A key that woke the pane during this refresh is caught up now.
        const next = attention.state();
        timer = setTimeout(
          tick,
          next === "waking"
            ? 0
            : next === "idle"
              ? idleInterval
              : refreshInterval,
        );
      }
    }
  };
  const stopListening = attention.subscribe(() => {
    if (attention.state() === "waking" && !running) void tick();
  });
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
    stopListening();
    stopWatching();
  };
}
