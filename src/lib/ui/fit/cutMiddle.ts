import { sanitize } from "../../text/index.js";
import { graphemes } from "./constants.js";
import measureCluster from "./measureCluster.js";
import measureText from "./measureText.js";

/** The graphemes of `segments`, in order, that fit `cells` display cells. */
function takeCells(segments: readonly string[], cells: number): string[] {
  const kept: string[] = [];
  let used = 0;
  for (const segment of segments) {
    const width = measureCluster(segment);
    if (used + width > cells) break;
    kept.push(segment);
    used += width;
  }
  return kept;
}

/**
 * Fits `text` into `width` display cells on one line: whole when it fits,
 * otherwise cut in its middle with `…`, keeping its start and, the larger
 * half, its end, where an identifier such as `example#12` or a branch
 * carries its meaning. As `trimText` does, it removes escape sequences and
 * control characters first, and counts display cells, not characters.
 */
export default function cutMiddle(text: string, width: number): string {
  const clean = sanitize(text);
  if (measureText(clean) <= width) return clean;
  if (width <= 0) return "";
  const segments = [...graphemes.segment(clean)].map(({ segment }) => segment);
  const room = width - 1;
  const tail = takeCells([...segments].reverse(), Math.ceil(room / 2));
  const head = takeCells(segments, room - measureText(tail.join("")));
  return `${head.join("")}…${tail.reverse().join("")}`;
}
