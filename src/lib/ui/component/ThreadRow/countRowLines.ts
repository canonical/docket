import listOwnerLines from "./listOwnerLines.js";
import type { ThreadRowProps } from "./types.js";

/**
 * How many lines `row` takes at `width`: two, and the lines naming its
 * owners when two or more own it. The list reads it to keep the selected
 * row in view before drawing.
 */
export default function countRowLines(
  row: ThreadRowProps["row"],
  width: number,
): number {
  return 2 + listOwnerLines(row, width).length;
}
