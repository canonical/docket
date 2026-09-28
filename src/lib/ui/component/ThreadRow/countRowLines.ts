import type { WaitRow } from "../../../owed/index.js";
import listOwnerLines from "./listOwnerLines.js";

/**
 * How many lines `row` takes at `width`: two, and the lines naming its
 * owners when two or more own it. The list reads it to keep the selected
 * row in view before drawing.
 */
export default function countRowLines(row: WaitRow, width: number): number {
  return 2 + listOwnerLines(row, width).length;
}
