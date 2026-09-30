import { accordionMaxLines } from "../../constants.js";
import { endRuns, fitRuns, wrapRuns } from "../../fit/index.js";
import type { Piece } from "../../types.js";
import type { DetailLine, DetailText } from "./types.js";

/** One line's runs as they fill the room: wrapped over lines, or trimmed to one. */
function fitLine({ pieces, fit }: DetailLine, room: number): Piece[][] {
  if (fit === "trimmed") return [fitRuns(pieces, room)];
  return wrapRuns(pieces, room);
}

/**
 * Fits what the accordion shows into at most `lines` lines of `room`
 * cells: the stack lines always, and the body in the lines they leave. A
 * line marked optional shows only when it fits whole. Content past the
 * last line is cut, and only the last line kept ends in `…`.
 */
export default function fitAccordion(
  { body, stack }: DetailText,
  room: number,
  lines = accordionMaxLines,
): Piece[][] {
  const bottom = stack.flatMap((line) => fitLine(line, room));
  const left = lines - bottom.length;
  const drawn: Piece[][] = [];
  for (const line of body) {
    const fitted = fitLine(line, room);
    if (fitted.length <= left - drawn.length) {
      drawn.push(...fitted);
    } else if (!line.optional) {
      const kept = [...drawn, ...fitted].slice(0, left);
      // The last line kept ends in …, each of its runs in its own colour.
      const ended = kept.slice(-1).map((line) => endRuns(line, room));
      return [...kept.slice(0, -1), ...ended, ...bottom];
    }
  }
  return [...drawn, ...bottom];
}
