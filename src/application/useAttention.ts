import { useRenderer } from "@opentui/react";
import { useEffect, useSyncExternalStore } from "react";
import type { Attention, AttentionState } from "../lib/cache/index.js";

/** Props for the useAttention hook. */
export interface UseAttentionProps {
  /** The pane's attention, which the refresh cycle follows, if it runs. */
  readonly attention:
    | Pick<Attention, "press" | "state" | "subscribe">
    | undefined;
}

/**
 * Result of the useAttention hook: the pane's state, `active` when no
 * refresh cycle runs to follow it.
 */
export type UseAttentionResult = AttentionState;

const ignoreChanges = () => () => {};
const readActive = (): AttentionState => "active";

/**
 * Counts every key the terminal sends as the pane's attention, whatever
 * the key then does: it keeps the pane active, or wakes an idle one. The
 * listener goes before the keymap's, which stops a key it acts on from
 * reaching any listener after it.
 *
 * @note Impure: listens to the renderer's keys while mounted.
 */
export default function useAttention({
  attention,
}: UseAttentionProps): UseAttentionResult {
  const { keyInput } = useRenderer();
  useEffect(() => {
    if (!attention) return;
    const press = () => attention.press();
    keyInput.prependListener("keypress", press);
    return () => {
      keyInput.off("keypress", press);
    };
  }, [keyInput, attention]);
  return useSyncExternalStore(
    attention?.subscribe ?? ignoreChanges,
    attention?.state ?? readActive,
  );
}
