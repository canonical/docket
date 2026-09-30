import { sanitize } from "../../text/index.js";
import measureText from "./measureText.js";
import trimText from "./trimText.js";

/**
 * Fits the runs of one line, each drawn in its own look, into `width`
 * display cells: runs that fit are kept whole, the run that crosses the
 * width is cut with `…`, and the runs after it are dropped. Each run
 * passes through `sanitize` first, as `trimText` does, since a run may
 * carry text written on GitHub, such as a check's name.
 */
export default function fitPieces<Piece extends { readonly text: string }>(
  pieces: readonly Piece[],
  width: number,
): Piece[] {
  const fitted: Piece[] = [];
  let room = width;
  for (const piece of pieces) {
    if (room === 0) break;
    const text = sanitize(piece.text);
    const cells = measureText(text);
    if (cells > room) {
      fitted.push({ ...piece, text: trimText(text, room) });
      break;
    }
    fitted.push({ ...piece, text });
    room -= cells;
  }
  return fitted;
}
