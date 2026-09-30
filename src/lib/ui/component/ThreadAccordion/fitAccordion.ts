import { accordionMaxLines } from "../../constants.js";
import { endRuns, fitRuns, wrapRuns } from "../../fit/index.js";
import type { Piece } from "../../types.js";
import type { DetailLine, DetailText } from "./types.js";

/** One line's runs as they fill the room: wrapped over lines, or trimmed to one. */
function fitLine({ pieces, fit }: DetailLine, room: number): Piece[][] {
  if (fit === "trimmed") return [fitRuns(pieces, room)];
  return wrapRuns(pieces, room);
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
