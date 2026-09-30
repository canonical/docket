import { useRef, useState } from "react";

/** Result of the useHelp hook: whether the help shows, and where it is scrolled. */
export interface UseHelpResult {
  readonly open: boolean;
  /** Shows the help from its top, or hides it. */
  readonly toggle: () => void;
  /** Hides the help. */
  readonly close: () => void;
  /** The place of the first thing the help shows, which it is drawn from. */
  readonly first: number;
  /** Told what the help shows after each draw, which the steps start from. */
  readonly onShown: (rows: number, first: number) => void;
  /** Scrolls the help by `step` of its lines of keys, groups and notes. */
  readonly scroll: (step: number) => void;
  /** Scrolls the help by as many key lines as it shows, up when negative. */
  readonly page: (direction: -1 | 1) => void;
  /** Scrolls the help to its top when negative, and to its end otherwise. */
  readonly end: (direction: -1 | 1) => void;
}

/**
 * The help's state: whether it shows, and where it is scrolled. The
 * movement keys move the list's selection, and while the help shows they
 * scroll it instead, by the same steps: a line of keys, a page, or to
 * either end. Each step starts from where the help was last drawn, so a
 * step past the end leaves it at its end.
 */
export default function useHelp(): UseHelpResult {
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState(0);
  const shown = useRef({ rows: 1, first: 0 });
  const moveTo = (place: number) => setFirst(Math.max(0, place));
  return {
    open,
    toggle: () => {
      setFirst(0);
      setOpen((showing) => !showing);
    },
    close: () => setOpen(false),
    first,
    onShown: (rows, drawn) => {
      shown.current = { rows: Math.max(1, rows), first: drawn };
    },
    scroll: (step) => moveTo(shown.current.first + step),
    page: (direction) =>
      moveTo(shown.current.first + direction * shown.current.rows),
    end: (direction) => moveTo(direction < 0 ? 0 : Number.MAX_SAFE_INTEGER),
  };
}
