import { idleAfter } from "./constants.js";
import type { Attention, AttentionState } from "./types.js";

/**
 * The attention of one terminal pane, which starts active: it turns idle
 * once no key was pressed for `idleAfter`, and the first key after that
 * wakes it, until the refresh cycle has caught up and settles it active
 * again. Attention is per pane: each process keeps its own.
 *
 * @note Impure: sets a timer, until stopped.
 */
export default function createAttention(): Attention {
  let state: AttentionState = "active";
  const listeners = new Set<() => void>();
  const change = (next: AttentionState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const wait = () => setTimeout(() => change("idle"), idleAfter);
  let timer = wait();
  return {
    state: () => state,
    press() {
      clearTimeout(timer);
      timer = wait();
      if (state === "idle") change("waking");
    },
    settle() {
      if (state === "waking") change("active");
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    stop() {
      clearTimeout(timer);
    },
  };
}
