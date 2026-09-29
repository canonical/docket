import type { Piece } from "./types.js";

/** The display cells the runs of a line take together. */
export default function measurePieces(pieces: readonly Piece[]): number {
  return pieces.reduce((sum, { text }) => sum + Bun.stringWidth(text), 0);
}
