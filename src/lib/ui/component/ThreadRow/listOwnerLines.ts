import { tokens } from "../../../tokens/index.js";
import { loginCells } from "../../constants.js";
import { markPerson, measureText } from "../../fit/index.js";
import type { Piece } from "../../types.js";
import { marginCells } from "../Margin/constants.js";
import type { ThreadRowProps } from "./types.js";

/**
 * The third line of a row that two or more people own, wrapped between
 * owners to as many lines as it needs: every owner behind their mark,
 * each login cut at 12 cells, separated by commas. A row with one owner,
 * or none, names it on its second line and has none.
 *
 * @param width The width of the pane, in display cells.
 */
export default function listOwnerLines(
  row: ThreadRowProps["row"],
  width: number,
): Piece[][] {
  if (!row.owners) return [];
  const room = width - marginCells;
  const comma: Piece = { text: ", ", fg: tokens["color.text"] };
  const lines: Piece[][] = [];
  let line: Piece[] = [];
  let used = 0;
  for (const owner of row.owners.fields) {
    const marked = markPerson(owner, loginCells);
    const cells = measureText(marked.text);
    if (line.length > 0 && used + 2 + cells <= room) {
      line.push(comma, marked);
      used += 2 + cells;
    } else {
      if (line.length > 0) lines.push([...line, { ...comma, text: "," }]);
      line = [marked];
      used = cells;
    }
  }
  return [...lines, line];
}
