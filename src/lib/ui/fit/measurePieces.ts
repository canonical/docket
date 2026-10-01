import measureText from "./measureText.js";
import type { Run } from "./types.js";

/** The display cells the runs of a line take together. */
export default function measurePieces<Look extends Run>(
  pieces: readonly Look[],
): number {
  return pieces.reduce((sum, { text }) => sum + measureText(text), 0);
}
