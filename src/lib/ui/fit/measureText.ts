import { graphemes } from "./constants.js";
import measureCluster from "./measureCluster.js";

/** Text of printable ASCII only, which takes one cell a character. */
const plain = /^[\x20-\x7e]*$/;

/**
 * The display cells `text` takes as OpenTUI draws it, character by
 * character: the one measure every fitting and every layout of the
 * terminal counts with, so a line fitted to its width is drawn within it
 * and ends where it should. Bun's own measure disagrees with OpenTUI on
 * much text, such as `❤`, which it counts one cell where OpenTUI draws
 * two, or an emoji with a skin tone, two where it draws four. Not pure:
 * it measures through `measureCluster`, which keeps its answers and calls
 * OpenTUI's native library.
 */
export default function measureText(text: string): number {
  if (plain.test(text)) return text.length;
  let cells = 0;
  for (const { segment } of graphemes.segment(text)) {
    cells += measureCluster(segment);
  }
  return cells;
}
