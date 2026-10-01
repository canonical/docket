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
 * other runs stay whole. `whole` gives the runs kept as they were before
 * the cut, run for run.
 */
function giveWay(
  line: DetailLine,
  room: number,
): { runs: Piece[]; whole: Piece[] } {
  const { pieces, kind, cuts } = line;
  const dropped = dropWhole(line, room);
  const cutting = pieces.length === 1 ? 0 : cuts;
  const over =
    measurePieces(pieces.filter((_, index) => !dropped.has(index))) - room;
  const whole = pieces.filter((_, index) => !dropped.has(index));
  const runs = pieces.flatMap((piece, index) => {
    if (dropped.has(index)) return [];
    if (index !== cutting || over <= 0) return [piece];
    const cells = measureText(piece.text) - over;
    return [
      { ...piece, text: fitField({ text: piece.text, kind }, "line", cells) },
    ];
  });
  return { runs, whole };
}

/**
 * Whether fitting cut the last of `held` at its end, so the line ends in
 * `…`: that run is narrower than it was `whole` and ends in the mark. A
 * run cut in its middle, or runs left out whole, end in no `…`.
 */
function endsInCut(held: readonly Piece[], whole: readonly Piece[]): boolean {
  const at = held.length - 1;
  const last = held.slice(at);
  return (
    last.some(({ text }) => text.endsWith(tokens["glyph.cut"])) &&
    measurePieces(last) < measurePieces(whole.slice(at, at + 1))
  );
}

/**
 * A line as fitted: its runs, and whether it already ends in a `…`, the
 * dimmed one of details still to come or the one of a cut fitting made
 * at its end, so it is not ended with a second; a line held to one also
 * keeps what it holds, to end it in `…` when it is the last.
 */
interface Fitted {
  readonly runs: readonly Piece[];
  readonly ended: boolean;
  readonly held?: DetailLine;
}

/**
 * A held line ending in `…`, fitted to the room the mark leaves it as
 * it fits any room: the runs it `drops` leave whole first, and the run it
 * `cuts` is cut once by its kind's rule, so the mark follows a whole part
 * or a branch cut in its middle and docket's own words are never cut for
 * it. When that fitting cuts the line at its end, the line as `held` is
 * cut at its end for the mark instead.
 */
function endHeld(
  line: DetailLine,
  held: readonly Piece[],
  room: number,
): Piece[] {
  const mark = tokens["glyph.cut"];
  const given = giveWay(line, room - measureText(mark));
  const runs = fitRuns(given.runs, room - measureText(mark));
  const last = runs.at(-1);
  if (last === undefined || endsInCut(runs, given.whole)) {
    return endRuns(held, room);
  }
  return [
    ...runs.slice(0, -1),
    { ...last, text: `${last.text.trimEnd()}${mark}` },
  ];
}

/** Draws the dimmed `…` that ends a line still waiting for the details. */
const drawPendingMark = (after: boolean): Piece => ({
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
  const runs = pending
    ? [...pieces, drawPendingMark(pieces.length > 0)]
    : pieces;
  const given = giveWay({ ...line, pieces: runs }, room);
  const held = fitRuns(given.runs, room);
  const ended = pending === true || endsInCut(held, given.whole);
  return [{ runs: held, ended, held: line }];
}

/**
 * `lines` with the last of them ending in `…`, to say more follows,
 * unless it already ends in one.
 */
const endLast = (lines: readonly Fitted[], room: number): Fitted[] => [
  ...lines.slice(0, -1),
  ...lines.slice(-1).map((line) =>
    line.ended
      ? line
      : {
          runs: line.held
            ? endHeld(line.held, line.runs, room)
            : endRuns(line.runs, room),
          ended: true,
        },
  ),
];

/** A run of nothing but spaces and commas, which joins two names. */
const separator = /^[\s,]*$/;

/**
 * A line that yields, in at most `lines` lines of `room` cells, ending in
 * a `…` of its own, in the text's plain colour, after the comma that
 * follows the last whole name to leave the mark room: the names past it
 * leave whole, so no name, a person's or a team's, is cut inside or read
 * as cut, and the mark never passes the room. With no whole name kept it
 * gets no line.
 */
function endWhole(
  { pieces, kind }: DetailLine,
  room: number,
  lines: number,
): Fitted[] {
  const mark = { text: tokens["glyph.cut"], fg: tokens["color.text"] };
  // The separators past the first name, each after a whole name.
  const ends = pieces.flatMap(({ text }, index) =>
    index > 1 && separator.test(text) ? [index] : [],
  );
  const fitTo = (end: number) =>
    fitBlock(
      [
        ...pieces.slice(0, end),
        ...pieces
          .slice(end, end + 1)
          .map((piece) => ({ ...piece, text: piece.text.trimEnd() })),
        mark,
      ],
      kind,
      room,
    );
  // The last end, the most names, that fits.
  const kept =
    ends
      .toReversed()
      .map(fitTo)
      .find((fitted) => fitted.length <= lines) ?? [];
  return kept.map((held, index) => ({
    runs: held,
    ended: index === kept.length - 1,
  }));
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
