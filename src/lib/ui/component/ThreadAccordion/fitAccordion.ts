import { accordionMaxLines } from "../../constants.js";
import { fitRules } from "../../fit/constants.js";
import {
  endRuns,
  fitField,
  fitRuns,
  measurePieces,
  wrapRuns,
} from "../../fit/index.js";
import type { Piece } from "../../types.js";
import type { DetailLine, DetailText } from "./types.js";

/**
 * One line's runs as they fill the room, by the rule the fitting table
 * gives its kind: wrapped in a block, or kept whole on one. A line held
 * to one is fitted by its kind's rule for a line: a single run as the
 * table fits that kind, several runs with the one that gives way cut by
 * the kind's rule, and the others at the end.
 */
function fitLine(
  { pieces, kind, most, gives }: DetailLine,
  room: number,
): Piece[][] {
  if (most === 1) {
    // A single run gives way by its kind; of several, the one named.
    const giving = pieces.length === 1 ? 0 : gives;
    const others = pieces.filter((_, place) => place !== giving);
    const rest = measurePieces(others);
    const [first] = others;
    if (first && giving !== undefined && rest >= room) {
      // Even without the giving run the line is too wide: it leaves, and
      // the rest is cut by the kind's rule, as one run.
      const text = others
        .map((piece) => piece.text)
        .join("")
        .trimStart();
      return [[{ ...first, text: fitField({ text, kind }, "line", room) }]];
    }
    const fitted = pieces.map((piece, place) =>
      place === giving
        ? {
            ...piece,
            text: fitField({ text: piece.text, kind }, "line", room - rest),
          }
        : piece,
    );
    return [fitRuns(fitted, room)];
  }
  return fitRules[kind].block === "wrap"
    ? wrapRuns(pieces, room)
    : [fitRuns(pieces, room)];
}

/** `lines` with the last of them ending in `…`, to say more follows. */
const endLast = (lines: readonly Piece[][], room: number): Piece[][] => [
  ...lines.slice(0, -1),
  ...lines.slice(-1).map((line) => endRuns(line, room)),
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
