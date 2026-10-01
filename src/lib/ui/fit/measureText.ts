import { asciiText } from "./constants.js";
import measureOnce from "./measureOnce.js";

/**
 * The most texts whose cells are kept: enough for every title, login and
 * label a screen draws, so a redraw measures none of them twice; once it
 * is reached, every kept text is forgotten, which costs less than
 * forgetting them one by one.
 */
const textsKept = 4096;

/** The cells of each text kept. */
const measuredTexts = new Map<string, number>();

/**
 * The display cells `text` takes, character by character, each counted
 * as the wider of OpenTUI's two width methods (`measureClusters`): the one
 * measure every fitting and every layout of the terminal counts with, so
 * a line fitted to its width never runs past it, whichever method the
 * terminal draws with, and may stop short of it. Bun's own measure
 * counts much text narrower than OpenTUI draws it, such as `❤`, one cell
 * where OpenTUI draws two. Text measured once in a while is measured
 * with `measureOnce`, which keeps nothing.
 *
 * @note Impure: it keeps the cells of up to `textsKept` texts, and
 * measures through `measureClusters`, which keeps its answers and calls
 * OpenTUI's native library.
 */
export default function measureText(text: string): number {
  if (asciiText.test(text)) return text.length;
  const known = measuredTexts.get(text);
  if (known !== undefined) return known;
  const cells = measureOnce(text);
  if (measuredTexts.size >= textsKept) measuredTexts.clear();
  measuredTexts.set(text, cells);
  return cells;
}
