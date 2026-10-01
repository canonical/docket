import { graphemes } from "./constants.js";
import measureClusters from "./measureClusters.js";

/**
 * The most texts whose cells are kept: enough for every title, login and
 * label a screen draws, so a redraw measures none of them twice; past it,
 * the text measured least lately is forgotten.
 */
const textsKept = 4096;

/** The cells of each text kept, the one measured least lately first. */
const measuredTexts = new Map<string, number>();

/** Text of printable ASCII only, which takes one cell a character. */
const plain = /^[\x20-\x7e]*$/;

/**
 * The display cells `text` takes, character by character, each counted
 * as the wider of OpenTUI's two width methods (`measureClusters`): the one
 * measure every fitting and every layout of the terminal counts with, so
 * a line fitted to its width never runs past it, whichever method the
 * terminal draws with, and may stop short of it. Bun's own measure
 * counts much text narrower than OpenTUI draws it, such as `❤`, one cell
 * where OpenTUI draws two.
 *
 * @note Impure: it keeps the cells of the 4096 texts it measured last,
 * and measures through `measureClusters`, which keeps its answers and
 * calls OpenTUI's native library.
 */
export default function measureText(text: string): number {
  if (plain.test(text)) return text.length;
  const known = measuredTexts.get(text);
  if (known !== undefined) {
    measuredTexts.delete(text);
    measuredTexts.set(text, known);
    return known;
  }
  const clusters = [...graphemes.segment(text)].map(({ segment }) => segment);
  const cells = measureClusters(clusters).reduce((sum, each) => sum + each, 0);
  measuredTexts.set(text, cells);
  for (const [oldest] of measuredTexts) {
    if (measuredTexts.size <= textsKept) break;
    measuredTexts.delete(oldest);
  }
  return cells;
}
