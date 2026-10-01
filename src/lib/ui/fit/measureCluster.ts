import { ascii } from "./constants.js";
import measureClusters from "./measureClusters.js";

/**
 * The cells one character, a grapheme cluster, takes, as `measureClusters`
 * counts it: for a fitting loop that measures the character in hand, a
 * printable ASCII one counted without the batch.
 *
 * @note Impure: it measures through `measureClusters`, which keeps its
 * answers and calls OpenTUI's native library.
 */
export default function measureCluster(cluster: string): number {
  if (ascii.test(cluster)) return 1;
  return measureClusters([cluster]).reduce((sum, cells) => sum + cells, 0);
}
