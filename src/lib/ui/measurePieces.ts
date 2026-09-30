import { measureText } from "./fit/index.js";
import type { Piece } from "./types.js";

/** The display cells the runs of a line take together. */
export default function measurePieces(pieces: readonly Piece[]): number {
  return pieces.reduce((sum, { text }) => sum + measureText(text), 0);
}
