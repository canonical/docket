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
 * The lines fitting cut, or that end in the dimmed `…` of details still
 * to come: each already says more follows, by the cut that made it.
 */
const ended = new WeakSet<readonly Piece[]>();

/**
 * One line's runs as they fill the room, by the rule the fitting table
 * gives its kind: wrapped in a block, or kept whole on one. A line held
 * to one gives way by its runs that may (`giveWay`), and any line still
 * too wide is cut at its end.
 */
function fitLine(line: DetailLine, room: number): Piece[][] {
  const { pieces, kind, most, waiting } = line;
  if (most !== 1) return fitBlock(pieces, kind, room);
  const held = fitRuns(giveWay(line, room), room);
  if (waiting || measurePieces(held) < measurePieces(pieces)) ended.add(held);
  return [held];
}

/**
 * `lines` with the last of them ending in `…`, to say more follows,
 * unless fitting already cut it, or it waits on the details: such a line
 * keeps the one `…` it has, whatever its text holds.
 */
const endLast = (lines: readonly Piece[][], room: number): Piece[][] => [
  ...lines.slice(0, -1),
  ...lines
    .slice(-1)
    .map((line) => (ended.has(line) ? line : endRuns(line, room))),
];

/**
 * `line` ending in a `…` of its own, in the text's plain colour, after
 * the runs that leave it the cell: the runs past them, a name or the
 * comma after one, leave whole, so no name is cut inside.
 */
function endWhole(line: readonly Piece[], room: number): Piece[] {
  const kept = [...line];
  // A name is never the run the `…` follows, which would read as cut.
  while (
    kept.length > 1 &&
    (measurePieces(kept) + 1 > room || kept.at(-1)?.marked)
  ) {
    kept.pop();
  }
  return [...kept, { text: tokens["glyph.cut"], fg: tokens["color.text"] }];
}

/**
 * Fits what the accordion shows into at most `lines` lines of `room`
 * cells, never more: the stack lines first, and the body in the lines
 * they leave, a line that yields in those the others leave it, ending
 * in `…` after a whole name when it runs out, and the accordion's last
 * line ending in `…` when it gets none. A line marked optional shows
 * only when it fits whole.
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
  // Whether a line that yields was left out, or cut, so the accordion's
  // last line says more follows.
  let yielded = false;
  for (const { line, fitted } of lined) {
    if (line.yields) {
      const taken = Math.max(0, Math.min(spare, fitted.length));
      const kept = fitted.slice(0, taken);
      drawn.push(
        ...(taken < fitted.length && taken > 0
          ? [
              ...kept.slice(0, -1),
              ...kept.slice(-1).map((last) => endWhole(last, room)),
            ]
          : kept),
      );
      yielded ||= taken === 0 && fitted.length > 0;
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
  return yielded ? endLast([...drawn, ...bottom], room) : [...drawn, ...bottom];
}
