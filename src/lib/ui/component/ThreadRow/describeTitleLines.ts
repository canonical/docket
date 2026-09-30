import { tokens } from "../../../tokens/index.js";
import { loginCells } from "../../constants.js";
import { fitField, markPerson, measureText } from "../../fit/index.js";
import measurePieces from "../../measurePieces.js";
import type { Piece } from "../../types.js";
import type { ThreadRowProps } from "./types.js";

/** The cells between the title and the group at its right, and inside the group. */
const gutter = 2;

const space = (count: number): Piece => ({
  text: " ".repeat(Math.max(0, count)),
  fg: tokens["color.text"],
});

/** The fewest cells a title keeps beside the group before the group gives way. */
const titleFloor = 8;

/**
 * What a row writes after `✗` for a repository whose own file is invalid:
 * the accordion and text mode keep the whole phrase, and a row has no
 * room for it beside a title.
 */
const invalidFileWord = "file";

/**
 * The group at the right of the title: `draft` dimmed, then each field in
 * trouble in the error colour after `✗`, so the colour is never the only
 * sign, then the owner with their mark. Failing checks are a field in
 * trouble of a running wait; activity tells of them as an event. With two
 * or more owners the owner is left out: they take a line of their own.
 * As the group gives way, `draft` leaves it; the owner never does.
 */
function listRight(row: ThreadRowProps["row"], draft: boolean): Piece[] {
  const error = tokens["color.text.error"];
  const failed = tokens["glyph.failed"];
  const parts: Piece[] = [
    ...(row.draft && draft
      ? [{ text: row.draft.text, fg: tokens["color.text.muted"] }]
      : []),
    ...("wait" in row && row.wait.thread.checks === "failing"
      ? [{ text: `${failed} checks`, fg: error }]
      : []),
    ...(row.invalidFile
      ? [{ text: `${failed} ${invalidFileWord}`, fg: error }]
      : []),
    ...(row.owner ? [markPerson(row.owner, loginCells)] : []),
  ];
  return parts.flatMap((part, place) =>
    place === 0 ? [part] : [space(gutter), part],
  );
}

/** The group whole when `fits` allows its cells, else without `draft`. */
function chooseRight(
  row: ThreadRowProps["row"],
  fits: (cells: number) => boolean,
): Piece[] {
  const whole = listRight(row, true);
  return fits(measurePieces(whole)) ? whole : listRight(row, false);
}

/**
 * The lines under the row's head: the title in italic at the left, then
 * the group at the right edge. The title gives way first: on a row that
 * is not selected it is trimmed to one line so the group always fits,
 * down to 8 cells, and past that `draft` leaves the group, the owner never;
 * on the selected row it wraps in full, and the group, given way only
 * as far as the line needs, sits on its last line when it fits there,
 * else on a line of its own.
 *
 * @param inner The cells beside the margin.
 */
export default function describeTitleLines(
  row: ThreadRowProps["row"],
  inner: number,
  selected: boolean,
): Piece[][] {
  const right = chooseRight(row, (cells) =>
    selected ? cells <= inner : inner - cells - gutter >= titleFloor,
  );
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
    return [pair(italic(fitField(row.title, "line", Math.max(0, room))))];
  }
  const titles = fitField(row.title, "block", inner);
  // The cells of the last line: a wrapped title takes one line at least.
  const lastCells = titles.reduce((_, title) => measureText(title), 0);
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
