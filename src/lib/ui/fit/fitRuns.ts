import { sanitize } from "../../text/index.js";
import fitPieces from "./fitPieces.js";
import measureText from "./measureText.js";
import type { Run } from "./types.js";

/**
 * The fewest cells a marked person is drawn in: the mark, a space, and
 * one cell of login before the `…`. With fewer, the person leaves the
 * line whole rather than show a mark with nobody behind it.
 */
const markedCells = 4;

/** A run of nothing but spaces and separators, which joins the runs either side. */
const joining = /^[\s,·]*$/;

/**
 * Fits the runs of one line, each drawn in its own look, into `width`
 * display cells: runs that fit are kept whole, the run that crosses the
 * width is cut with `…`, and the runs after it are dropped. A person's
 * mark never gives way: a marked run is cut in its login only, and leaves
 * the line when no cell of its login would show. Once a run gives way,
 * the separators left at the line's end go too, so a line never ends on
 * `, ` or ` · `. Each run passes through `sanitize`.
 */
export default function fitRuns<Look extends Run>(
  runs: readonly Look[],
  width: number,
): Look[] {
  const kept = fitPieces(runs, width);
  const last = kept.at(-1);
  const whole = runs.at(kept.length - 1);
  const shortened =
    last !== undefined &&
    whole !== undefined &&
    last.text !== sanitize(whole.text);
  if (!shortened && kept.length === runs.length) return kept;
  if (shortened && last.marked && measureText(last.text) < markedCells) {
    kept.pop();
  }
  for (
    let end = kept.at(-1);
    end && joining.test(end.text);
    end = kept.at(-1)
  ) {
    kept.pop();
  }
  return kept;
}
