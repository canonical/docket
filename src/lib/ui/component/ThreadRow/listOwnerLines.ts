import type { WaitRow } from "../../../owed/index.js";
import trimText from "../../trimText.js";
import wrapText from "../../wrapText.js";
import { loginCells, marginCells } from "./constants.js";

/**
 * The third line of a row that two or more people own, wrapped to as many
 * lines as it needs: every owner, each login cut at 12 cells. A row with
 * one owner, or none, names it on its second line and has none.
 *
 * @param width The width of the pane, in display cells.
 */
export default function listOwnerLines(row: WaitRow, width: number): string[] {
  if (!row.owners) return [];
  const logins = row.owners.fields.map(({ text }) =>
    trimText(text, loginCells),
  );
  return wrapText(logins.join(", "), width - marginCells);
}
