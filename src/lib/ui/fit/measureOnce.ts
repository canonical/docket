import { asciiText, graphemes } from "./constants.js";
import measureClusters from "./measureClusters.js";

/**
 * The display cells `text` takes, as `measureText` counts them, without
 * keeping the answer: for text measured once in a while, such as the
 * words and growing lines of a wrapped message, so they never crowd out
 * the texts every draw measures. Plain ASCII counts a cell a character.
 *
 * @note Impure: it measures through `measureClusters`, which keeps its
 * answers and calls OpenTUI's native library.
 */
export default function measureOnce(text: string): number {
  if (asciiText.test(text)) return text.length;
  const clusters = [...graphemes.segment(text)].map(({ segment }) => segment);
  return measureClusters(clusters).reduce((sum, each) => sum + each, 0);
}
