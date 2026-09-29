import { tokens } from "../../../tokens/index.js";
import { loginCells } from "../../constants.js";
import markPerson from "../../markPerson.js";
import measurePieces from "../../measurePieces.js";
import trimText from "../../trimText.js";
import type { Piece } from "../../types.js";
import wrapText from "../../wrapText.js";
import type { ThreadRowProps } from "./types.js";

/** The cells between the title and the group at its right, and inside the group. */
const gutter = 2;

const space = (count: number): Piece => ({
  text: " ".repeat(Math.max(0, count)),
  fg: tokens["color.text"],
});

/**
 * The group at the right of the title: `draft` dimmed, then each field in
 * trouble in the error colour after `✗`, so the colour is never the only
 * sign, then the owner with their mark. Failing checks are a field in
 * trouble of a running wait; activity tells of them as an event. With two
 * or more owners the owner is left out: they take a line of their own.
 */
function listRight(row: ThreadRowProps["row"]): Piece[] {
  const error = tokens["color.text.error"];
  const failed = tokens["glyph.failed"];
  const parts: Piece[] = [
    ...(row.draft
      ? [{ text: row.draft.text, fg: tokens["color.text.muted"] }]
      : []),
    ...("wait" in row && row.wait.thread.checks === "failing"
      ? [{ text: `${failed} checks`, fg: error }]
      : []),
    ...(row.invalidFile
      ? [{ text: `${failed} ${row.invalidFile.text}`, fg: error }]
      : []),
    ...(row.owner ? [markPerson(row.owner, loginCells)] : []),
  ];
  return parts.flatMap((part, place) =>
    place === 0 ? [part] : [space(gutter), part],
  );
}

/**
 * The lines under the row's head: the title in italic at the left, then
 * the group at the right edge. The title gives way first: on a row that
 * is not selected it is trimmed to one line so the group always fits;
 * on the selected row it wraps in full, and the group sits on its last
 * line when it fits there, else on a line of its own.
 *
 * @param inner The cells beside the margin.
 */
export default function describeTitleLines(
  row: ThreadRowProps["row"],
  inner: number,
  selected: boolean,
): Piece[][] {
  const right = listRight(row);
  const rightCells = measurePieces(right);
  const italic = (text: string): Piece => ({
    text,
    fg: tokens["color.text"],
    attributes: tokens["typography.style.italic"],
  });
  const pair = (title: Piece): Piece[] =>
    right.length === 0
      ? [title]
      : [
          title,
          space(Math.max(gutter, inner - measurePieces([title]) - rightCells)),
          ...right,
        ];
  if (!selected) {
    const room = right.length > 0 ? inner - rightCells - gutter : inner;
    return [pair(italic(trimText(row.title.text, Math.max(0, room))))];
  }
  const titles = wrapText(row.title.text, inner);
  // The cells of the last line: wrapText gives one line at least.
  const lastCells = titles.reduce((_, title) => Bun.stringWidth(title), 0);
  if (right.length > 0 && lastCells + gutter + rightCells > inner) {
    return [
      ...titles.map((title) => [italic(title)]),
      [space(inner - rightCells), ...right],
    ];
  }
  return titles.map((title, place) =>
    place === titles.length - 1 ? pair(italic(title)) : [italic(title)],
  );
}
