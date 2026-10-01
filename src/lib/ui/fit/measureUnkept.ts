import { asciiText, graphemes } from "./constants.js";
import measureClusters from "./measureClusters.js";

/**
 * The display cells `text` takes, as `measureText` counts them, without
 * keeping the answer: the measure under `measureText`'s cache of texts
 * and `measureWord`'s cache of wrapped words. Plain ASCII counts a cell a
 * character.
 *
 * @note Impure: it measures through `measureClusters`, which keeps its
 * answers and calls OpenTUI's native library.
 */
export default function measureUnkept(text: string): number {
  if (asciiText.test(text)) return text.length;
  const clusters = [...graphemes.segment(text)].map(({ segment }) => segment);
  return measureClusters(clusters).reduce((sum, each) => sum + each, 0);
}
