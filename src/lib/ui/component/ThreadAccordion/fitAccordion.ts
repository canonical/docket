import { tokens } from "../../../tokens/index.js";
import { accordionMaxLines } from "../../constants.js";
import {
  endRuns,
  fitBlock,
  fitField,
  fitRuns,
  measurePieces,
  measureText,
} from "../../fit/index.js";
import type { Piece } from "../../types.js";
import type { DetailLine, DetailText } from "./types.js";

/**
 * A held line's runs fitted to `room` by dropping whole parts before
 * cutting any: the runs it `drops` leave, in order, while the line is too
 * wide, then the run it `cuts` is cut once, by its kind's rule for a
 * line, to the room the others leave; a single run is the one cut. The
 * other runs stay whole.
 */
function giveWay(
  { pieces, kind, drops = [], cuts }: DetailLine,
  room: number,
): Piece[] {
  const dropped = new Set<number>();
  const remaining = () => pieces.filter((_, index) => !dropped.has(index));
  for (const index of drops) {
    if (measurePieces(remaining()) <= room) break;
    dropped.add(index);
  }
  const cutting = pieces.length === 1 ? 0 : cuts;
  const over = measurePieces(remaining()) - room;
  return pieces.flatMap((piece, index) => {
    if (dropped.has(index)) return [];
    if (index !== cutting || over <= 0) return [piece];
    const cells = measureText(piece.text) - over;
    return [
      { ...piece, text: fitField({ text: piece.text, kind }, "line", cells) },
    ];
  });
}

/**
 * One line's runs as they fill the room, by the rule the fitting table
 * gives its kind: wrapped in a block, or kept whole on one. A line held
 * to one gives way by its runs that may (`giveWay`), and any line still
 * too wide is cut at its end.
 */
function fitLine(line: DetailLine, room: number): Piece[][] {
  const { pieces, kind, most } = line;
  if (most === 1) return [fitRuns(giveWay(line, room), room)];
  return fitBlock(pieces, kind, room);
}

/**
 * `lines` with the last of them ending in `…`, to say more follows,
 * unless it already holds one: a line cut in its middle, or one still
 * waiting for the details, keeps the one `…` it has.
 */
const endLast = (lines: readonly Piece[][], room: number): Piece[][] => [
  ...lines.slice(0, -1),
  ...lines
    .slice(-1)
    .map((line) =>
      line.some(({ text }) => text.includes(tokens["glyph.cut"]))
        ? line
        : endRuns(line, room),
    ),
];

/**
 * Fits what the accordion shows into at most `lines` lines of `room`
 * cells, never more: the stack lines first, and the body in the lines
 * they leave, a line that yields in those the others leave it, one at
 * least, cut with `…` if it runs out. A line marked optional shows only when it fits
 * whole.
 * Content past the last line is cut, and only the last line kept ends in
 * `…`.
 */
export default function fitAccordion(
  { body, stack }: DetailText,
  room: number,
  lines = accordionMaxLines,
): Piece[][] {
  const bottom = stack.flatMap((line) => fitLine(line, room));
  const fits = Math.max(0, lines);
  // The stack lines alone can fill the lines: they keep as many as fit.
  if (bottom.length > fits) return endLast(bottom.slice(0, fits), room);
  const left = fits - bottom.length;
  const lined = body.map((line) => ({ line, fitted: fitLine(line, room) }));
  // A line that yields takes only what the lines that do not leave it.
  let spare =
    left -
    lined
      .filter(({ line }) => !line.yields && !line.optional)
      .reduce((sum, { fitted }) => sum + fitted.length, 0);
  const drawn: Piece[][] = [];
  for (const { line, fitted } of lined) {
    if (line.yields) {
      // It keeps one line at least, ending in … when it is cut, while any
      // is left: the lines after it give way then, so it never leaves
      // without a mark.
      const taken = Math.max(
        0,
        Math.min(Math.max(1, spare), fitted.length, left - drawn.length),
      );
      if (taken === 0) return endLast([...drawn, ...bottom], room);
      // Held to one line, it names what it can there, a person cut after
      // their mark.
      const kept =
        taken === 1 && fitted.length > 1
          ? [fitRuns(line.pieces, room)]
          : fitted.slice(0, taken);
      drawn.push(...(taken < fitted.length ? endLast(kept, room) : kept));
      spare -= taken;
    } else if (fitted.length <= left - drawn.length) {
      drawn.push(...fitted);
    } else if (!line.optional) {
      const kept = [...drawn, ...fitted].slice(0, left);
      // The last line kept ends in …, each of its runs in its own colour;
      // with no body line kept, the stack's last does.
      return kept.length > 0
        ? [...endLast(kept, room), ...bottom]
        : endLast(bottom, room);
    }
  }
  return [...drawn, ...bottom];
}
