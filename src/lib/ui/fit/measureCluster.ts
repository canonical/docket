import measureClusters from "./measureClusters.js";

/**
 * The cells one character, a grapheme cluster, takes, as `measureClusters`
 * counts it: for a fitting loop that measures the character in hand.
 *
 * @note Impure: it measures through `measureClusters`, which keeps its
 * answers and calls OpenTUI's native library.
 */
export default function measureCluster(cluster: string): number {
  return measureClusters([cluster]).reduce((sum, cells) => sum + cells, 0);
}
