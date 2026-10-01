import { graphemes } from "./constants.js";
import measureClusters from "./measureClusters.js";

/** Text of printable ASCII only, which takes one cell a character. */
const plain = /^[\x20-\x7e]*$/;

/**
 * The display cells `text` takes, character by character, each counted
 * as the wider of OpenTUI's two width methods (`measureClusters`): the one
 * measure every fitting and every layout of the terminal counts with, so
 * a line fitted to its width never runs past it, whichever method the
 * terminal draws with, and may stop a cell short. Bun's own measure
 * counts much text narrower than OpenTUI draws it, such as `❤`, one cell
 * where OpenTUI draws two.
 *
 * @note Impure: it measures through `measureClusters`, which keeps its
 * answers and calls OpenTUI's native library.
 */
export default function measureText(text: string): number {
  if (plain.test(text)) return text.length;
  const clusters = [...graphemes.segment(text)].map(({ segment }) => segment);
  return measureClusters(clusters).reduce((sum, cells) => sum + cells, 0);
}
