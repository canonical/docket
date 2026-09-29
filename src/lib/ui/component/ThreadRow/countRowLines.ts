import { marginCells } from "../Margin/constants.js";
import describeTitleLines from "./describeTitleLines.js";
import listOwnerLines from "./listOwnerLines.js";
import type { ThreadRowProps } from "./types.js";

/**
 * How many lines `row` takes at `width`: its head, its title's lines, one
 * unless the row is selected, when the title wraps in full, and the lines
 * naming its owners when two or more own it. The list reads it to keep
 * the selected row in view before drawing.
 */
export default function countRowLines(
  row: ThreadRowProps["row"],
  width: number,
  selected = false,
): number {
  return (
    1 +
    describeTitleLines(row, width - marginCells, selected).length +
    listOwnerLines(row, width).length
  );
}
