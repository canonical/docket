import { useState } from "react";
import type { UseDrawnLinesResult } from "./types.js";

/** The lines an item's accordion drew last. */
interface Drawn {
  readonly key: string;
  readonly lines: number;
}

/**
 * Keeps the height the selected item's accordion drew last, so a list
 * counts what is on screen rather than what the snapshot gave: a thread's
 * details can make the accordion taller than the snapshot's lines, as a
 * closed thread's close body does in place of `loading…`, or a failed
 * read's line under them. The list scrolls before the grown accordion
 * is painted, so the item stays whole in view.
 */
export default function useDrawnLines(): UseDrawnLinesResult {
  const [drawn, setDrawn] = useState<Drawn>();
  return {
    measure: (key, counted) => (drawn?.key === key ? drawn.lines : counted),
    report: (key) => (lines) =>
      setDrawn((current) =>
        current?.key === key && current.lines === lines
          ? current
          : { key, lines },
      ),
  };
}
