import type { ThreadRow } from "../lib/activity/index.js";
import type { FinishedRow } from "../lib/finished/index.js";
import type { WaitRow } from "../lib/owed/index.js";
import identifyRow from "./identifyRow.js";

/** Where the selection is: its place in the list, and the row there. */
export interface Selection {
  readonly place: number;
  /** The row at `place` when it was selected, as `identifyRow` names it. */
  readonly row: string;
}

/**
 * The place of the selection in `rows`, the list's rows in the order
 * they are drawn. It stays where it was while the same row is there; it
 * follows the row when the list moves it, as a refresh or another
 * grouping does; and it keeps its place, within the list, when the row
 * is gone. A wait with two owners is drawn once under each in `by owner`,
 * so the place decides between two rows naming the same wait.
 */
export default function placeSelection(
  rows: readonly (WaitRow | ThreadRow | FinishedRow)[],
  { place, row }: Selection,
): number {
  const at = rows.at(place);
  if (at && identifyRow(at) === row) return place;
  const found = rows.findIndex((each) => identifyRow(each) === row);
  if (found >= 0) return found;
  return Math.max(0, Math.min(place, rows.length - 1));
}
