import { sanitize } from "../../text/index.js";
import fitPieces from "./fitPieces.js";
import measureText from "./measureText.js";

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
export default function fitRuns<
  Run extends { readonly text: string; readonly marked?: boolean },
>(runs: readonly Run[], width: number): Run[] {
  const kept = fitPieces(runs, width);
  const end = kept.length - 1;
  const shortened = end >= 0 && kept[end].text !== sanitize(runs[end].text);
  if (!shortened && kept.length === runs.length) return kept;
  if (
    shortened &&
    kept[end].marked &&
    measureText(kept[end].text) < markedCells
  ) {
    kept.pop();
  }
  while (kept.length > 0 && joining.test(kept[kept.length - 1].text)) {
    kept.pop();
  }
  return kept;
}
