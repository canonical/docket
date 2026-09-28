import type { WaitRow } from "../lib/owed/index.js";
import identifyRow from "./identifyRow.js";

/** Where the selection is: its place in the list, and the wait there. */
export interface Selection {
  readonly place: number;
  /** The wait at `place` when it was selected, as `identifyRow` names it. */
  readonly wait: string;
}

/**
 * The place of the selection in `rows`, the list's rows in the order
 * they are drawn. It stays where it was while the same wait is there; it
 * follows the wait when the list moves it, as a refresh or another
 * grouping does; and it keeps its place, within the list, when the wait
 * is gone. A wait with two owners is drawn once under each in `by owner`,
 * so the place decides between two rows naming the same wait.
 */
export default function placeSelection(
  rows: readonly WaitRow[],
  { place, wait }: Selection,
): number {
  const at = rows.at(place);
  if (at && identifyRow(at) === wait) return place;
  const found = rows.findIndex((row) => identifyRow(row) === wait);
  if (found >= 0) return found;
  return Math.max(0, Math.min(place, rows.length - 1));
}
