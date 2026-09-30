import { tokens } from "../../../tokens/index.js";
import { accordionMaxLines } from "../../constants.js";
import { fitRules } from "../../fit/constants.js";
import {
  endRuns,
  fitField,
  fitRuns,
  measurePieces,
  measureText,
  wrapRuns,
} from "../../fit/index.js";
import type { Piece } from "../../types.js";
import type { DetailLine, DetailText } from "./types.js";

/** The cells a run that gives way keeps while another can give way after it: half the narrowest room. */
const givingFloor = 16;

/** The fewest cells a cut run shows: fewer, and it leaves the line. */
const leastCut = 4;

/**
 * A held line's runs cut to `room`: the runs that give way, in order,
 * each cut once in the way its kind is cut on a line, all but the last
 * keeping 16 cells at least, and the last leaving the line when it
 * must; a single run gives way alone. The other runs stay whole.
 */
function giveWay(
  { pieces, kind, gives = [] }: DetailLine,
  room: number,
): Piece[] {
  const order = pieces.length === 1 ? [0] : gives;
  const plan = pieces
    .map((piece, index) => ({ piece, step: order.indexOf(index) }))
    .filter(({ step }) => step >= 0)
    .sort((a, b) => a.step - b.step);
  let over = measurePieces(pieces) - room;
  const kept = new Map<Piece, string>();
  for (const { piece, step } of plan) {
    if (over <= 0) break;
    const cells = measureText(piece.text);
    const floor = step === order.length - 1 ? 0 : Math.min(cells, givingFloor);
    // A run left with fewer cells than a cut can say anything in leaves.
    const left = Math.max(floor, cells - over);
    const keep = left < leastCut ? 0 : left;
    kept.set(piece, fitField({ text: piece.text, kind }, "line", keep));
    over -= cells - keep;
  }
  return pieces.map((piece) => ({
    ...piece,
    text: kept.get(piece) ?? piece.text,
  }));
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
  return fitRules[kind].block === "wrap"
    ? wrapRuns(pieces, room)
    : [fitRuns(pieces, room)];
}

/**
 * `lines` with the last of them ending in `…`, to say more follows,
 * unless it already holds one: a line cut in its middle, or one still
 * waiting for the details, is not cut again.
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
 * they leave, a line that yields in those the others leave it, cut with
 * `…` if it runs out. A line marked optional shows only when it fits
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
      const taken = Math.max(0, Math.min(spare, fitted.length));
      const kept = fitted.slice(0, taken);
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
