import { type RefObject, useRef } from "react";
import type { TerminalMode } from "./types.js";

/**
 * Result of the useShownList hook: how far a page moves the selection,
 * and what the mode's list is given to report what it shows.
 */
export interface UseShownListResult {
  /** How many rows the list showed last, at least one. */
  readonly pageRows: RefObject<number>;
  /** The list's props that report what it shows and restore its scroll. */
  readonly list: {
    readonly firstShown: number;
    readonly onShownRows: (rows: number, first: number) => void;
  };
}

/**
 * Keeps what each mode's list reported after its last draw: how many rows
 * it shows, which is how far a page moves the selection, and where it was
 * scrolled. The help and a pane too narrow take the list's place, so the
 * list is drawn anew once they leave, and it opens where it was rather
 * than at the top, as each mode keeps its own selection.
 */
export default function useShownList(mode: TerminalMode): UseShownListResult {
  const pageRows = useRef(1);
  const tops = useRef<Record<TerminalMode, number>>({ owed: 0, activity: 0 });
  return {
    pageRows,
    list: {
      firstShown: tops.current[mode],
      onShownRows: (rows, first) => {
        pageRows.current = Math.max(1, rows);
        tops.current[mode] = first;
      },
    },
  };
}
