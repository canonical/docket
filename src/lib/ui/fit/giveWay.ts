import type { FieldKind } from "../../owed/index.js";
import fitField from "./fitField.js";
import measurePieces from "./measurePieces.js";
import measureText from "./measureText.js";
import type { Run } from "./types.js";

/**
 * A line held to one, as its runs give way: its runs, the kind of text
 * they are, the runs that leave whole, in order (`drops`), and the one
 * run then cut (`cuts`).
 */
export interface HeldRuns<Look extends Run> {
  readonly pieces: readonly Look[];
  readonly kind: FieldKind;
  readonly drops?: readonly number[];
  readonly cuts?: number;
}

/**
 * Which of a held line's runs leave whole, in the order it `drops` them,
 * while the others are wider than `room`.
 */
function dropWhole<Look extends Run>(
  { pieces, drops = [] }: HeldRuns<Look>,
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
export default function giveWay<Look extends Run>(
  line: HeldRuns<Look>,
  room: number,
): { runs: Look[]; whole: Look[] } {
  const { pieces, kind, cuts } = line;
  const dropped = dropWhole(line, room);
  const cutting = pieces.length === 1 ? 0 : cuts;
  const whole = pieces.filter((_, index) => !dropped.has(index));
  const over = measurePieces(whole) - room;
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
