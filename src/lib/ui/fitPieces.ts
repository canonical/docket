import trimText from "./trimText.js";

/**
 * Fits the runs of one line, each drawn in its own look, into `width`
 * display cells: runs that fit are kept whole, the run that crosses the
 * width is cut with `…`, and the runs after it are dropped.
 */
export default function fitPieces<Piece extends { readonly text: string }>(
  pieces: readonly Piece[],
  width: number,
): Piece[] {
  const fitted: Piece[] = [];
  let room = width;
  for (const piece of pieces) {
    if (room === 0) break;
    const cells = Bun.stringWidth(piece.text);
    if (cells > room) {
      fitted.push({ ...piece, text: trimText(piece.text, room) });
      break;
    }
    fitted.push(piece);
    room -= cells;
  }
  return fitted;
}
