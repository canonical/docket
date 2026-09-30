import { accordionMaxLines } from "../../constants.js";
import { fitRules } from "../../fit/constants.js";
import { endRuns, fitField, fitRuns, wrapRuns } from "../../fit/index.js";
import type { Piece } from "../../types.js";
import type { DetailLine, DetailText } from "./types.js";

/**
 * One line's runs as they fill the room, by the rule the fitting table
 * gives its kind: wrapped in a block, or kept whole on one. A line held
 * to one is fitted by its kind's rule for a line: a single run as the
 * table fits that kind, several runs cut at the end.
 */
function fitLine({ pieces, kind, most }: DetailLine, room: number): Piece[][] {
  if (most === 1) {
    const [only] = pieces;
    return pieces.length === 1 && only
      ? [[{ ...only, text: fitField({ text: only.text, kind }, "line", room) }]]
      : [fitRuns(pieces, room)];
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
 * they leave. A line marked optional shows only when it fits whole.
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
  const drawn: Piece[][] = [];
  for (const line of body) {
    const fitted = fitLine(line, room);
    if (fitted.length <= left - drawn.length) {
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
