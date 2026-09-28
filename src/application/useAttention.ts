import { useRenderer } from "@opentui/react";
import { useEffect } from "react";
import type { Attention } from "../lib/cache/index.js";

/** Props for the useAttention hook. */
export interface UseAttentionProps {
  /** The pane's attention, which the refresh cycle follows, if it runs. */
  readonly attention: Pick<Attention, "press"> | undefined;
}

/**
 * Counts every key the terminal sends as the pane's attention, whatever
 * the key then does: it keeps the pane active, or wakes an idle one. The
 * listener goes before the keymap's, which stops a key it acts on from
 * reaching any listener after it.
 *
 * @note Impure: listens to the renderer's keys while mounted.
 */
export default function useAttention({ attention }: UseAttentionProps): void {
  const { keyInput } = useRenderer();
  useEffect(() => {
    if (!attention) return;
    const press = () => attention.press();
    keyInput.prependListener("keypress", press);
    return () => {
      keyInput.off("keypress", press);
    };
  }, [keyInput, attention]);
}
