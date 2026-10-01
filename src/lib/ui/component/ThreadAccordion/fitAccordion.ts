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
 * Which of a held line's runs leave whole, in the order it `drops` them,
 * while the others are wider than `room`.
 */
function dropWhole(
  { pieces, drops = [] }: DetailLine,
  room: number,
): ReadonlySet<number> {
  const dropped = new Set<number>();
  for (const index of drops) {
    const remaining = pieces.filter((_, each) => !dropped.has(each));
    if (measurePieces(remaining) <= room) break;
    dropped.add(index);
  }
  return dropped;
}

/**
 * A held line's runs fitted to `room` by dropping whole parts before
 * cutting any: the runs it `drops` leave, in order, while the line is too
 * wide, then the run it `cuts` is cut once, by its kind's rule for a
 * line, to the room the others leave; a single run is the one cut. The
 * other runs stay whole. `cut` says whether a run was cut: a part that
 * leaves whole says nothing of what follows.
 */
function giveWay(
  line: DetailLine,
  room: number,
): { runs: Piece[]; cut: boolean } {
  const { pieces, kind, cuts } = line;
  const dropped = dropWhole(line, room);
  const cutting = pieces.length === 1 ? 0 : cuts;
  const over =
    measurePieces(pieces.filter((_, index) => !dropped.has(index))) - room;
  const cut = over > 0 && cutting !== undefined;
  const runs = pieces.flatMap((piece, index) => {
    if (dropped.has(index)) return [];
    if (index !== cutting || !cut) return [piece];
    const cells = measureText(piece.text) - over;
    return [
      { ...piece, text: fitField({ text: piece.text, kind }, "line", cells) },
    ];
  });
  return { runs, cut };
}

/**
 * A line as fitted: its runs, and whether it already ends in a `…`, the
 * dimmed one of details still to come or the one of a cut fitting made,
 * so it is not ended with a second; a held line with parts that leave
 * whole also gives how it ends in `…` when it is the last.
 */
interface Fitted {
  readonly runs: readonly Piece[];
  readonly ended: boolean;
  readonly closing?: readonly Piece[];
}

/**
 * A held line ending in `…` after a whole part, the runs it `drops`
 * leaving whole, in order, until the mark has its cell, so docket's own
 * words are never cut for it; when they cannot make it room, its runs as
 * `held` are cut at their end.
 */
function endHeld(
  line: DetailLine,
  held: readonly Piece[],
  room: number,
): Piece[] {
  const dropped = dropWhole(line, room - 1);
  const kept = line.pieces.filter((_, index) => !dropped.has(index));
  const last = kept.pop();
  if (last === undefined || measurePieces([...kept, last]) >= room) {
    return endRuns(held, room);
  }
  const text = `${last.text.trimEnd()}${tokens["glyph.cut"]}`;
  return fitRuns([...kept, { ...last, text }], room);
}

/** The dimmed `…` that ends a line still waiting for the details. */
const pendingMark = (after: boolean): Piece => ({
  text: after ? ` ${tokens["glyph.cut"]}` : tokens["glyph.cut"],
  fg: tokens["color.text.muted"],
});

/**
 * One line's runs as they fill the room, by the rule the fitting table
 * gives its kind: wrapped in a block, or kept whole on one. A line held
 * to one gives way by its runs that may (`giveWay`), and any line still
 * too wide is cut at its end; a line waiting on the details ends in the
 * dimmed `…`.
 */
function fitLine(line: DetailLine, room: number): Fitted[] {
  const { pieces, kind, most, pending } = line;
  if (most !== 1) {
    return fitBlock(pieces, kind, room).map((runs) => ({ runs, ended: false }));
  }
  const runs = pending ? [...pieces, pendingMark(pieces.length > 0)] : pieces;
  const given = giveWay({ ...line, pieces: runs }, room);
  const held = fitRuns(given.runs, room);
  const cut = given.cut || measurePieces(held) < measurePieces(given.runs);
  const ended = pending === true || cut;
  if (ended || line.drops === undefined) return [{ runs: held, ended }];
  return [{ runs: held, ended, closing: endHeld(line, held, room) }];
}

/**
 * `lines` with the last of them ending in `…`, to say more follows,
 * unless it already ends in one.
 */
const endLast = (lines: readonly Fitted[], room: number): Fitted[] => [
  ...lines.slice(0, -1),
  ...lines
    .slice(-1)
    .map((line) =>
      line.ended
        ? line
        : { runs: line.closing ?? endRuns(line.runs, room), ended: true },
    ),
];

/**
 * A line that yields, in at most `lines` lines of `room` cells, ending in
 * a `…` of its own, in the text's plain colour, after the last whole name
 * and the comma after it that leave the mark room: the names past them
 * leave whole, so no name is cut inside, and the mark never passes the
 * room. With no whole name kept it gets no line.
 */
function endWhole(
  { pieces, kind }: DetailLine,
  room: number,
  lines: number,
): Fitted[] {
  const mark = { text: tokens["glyph.cut"], fg: tokens["color.text"] };
  for (let end = pieces.length; end > 0; end -= 1) {
    const kept = pieces.slice(0, end);
    if (!kept.some(({ marked }) => marked)) break;
    const last = kept.pop();
    // A name is never the run the `…` follows, which would read as cut.
    if (last === undefined || last.marked) continue;
    const runs = [...kept, { ...last, text: last.text.trimEnd() }, mark];
    const fitted = fitBlock(runs, kind, room);
    if (fitted.length <= lines) {
      return fitted.map((held, index) => ({
        runs: held,
        ended: index === fitted.length - 1,
      }));
    }
  }
  return [];
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
  return fitLines({ body, stack }, room, lines).map(({ runs }) => [...runs]);
}

/** `fitAccordion`'s lines, each with whether it already ends in `…`. */
function fitLines(
  { body, stack }: DetailText,
  room: number,
  lines: number,
): Fitted[] {
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
  const drawn: Fitted[] = [];
  // Whether a line that yields was left out, or cut, so the accordion's
  // last line says more follows.
  let yielded = false;
  for (const { line, fitted } of lined) {
    if (line.yields) {
      const taken = Math.max(0, Math.min(spare, fitted.length));
      const kept = taken < fitted.length ? endWhole(line, room, taken) : fitted;
      drawn.push(...kept);
      yielded ||= kept.length === 0 && fitted.length > 0;
      spare -= kept.length;
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
