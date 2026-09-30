import { sanitize } from "../../text/index.js";
import { graphemes } from "./constants.js";
import measureText from "./measureText.js";

/**
 * Fits `text` into `width` display cells on one line: whole when it fits,
 * otherwise cut and ended with `…`. Width is counted in cells, not
 * characters, by Bun's own measure, which agrees with the cells OpenTUI
 * draws: a wide character such as an emoji takes two, an arrow such as
 * `↔` one.
 *
 * Escape sequences and control characters are removed first, and a line
 * break becomes a space: OpenTUI puts every character into a cell as it
 * is, so a title written on GitHub could otherwise move the cursor or set
 * the clipboard of the terminal it is drawn in.
 */
export default function trimText(text: string, width: number): string {
  const clean = sanitize(text);
  if (measureText(clean) <= width) return clean;
  if (width <= 0) return "";
  let kept = "";
  let used = 0;
  for (const { segment } of graphemes.segment(clean)) {
    const cells = measureText(segment);
    if (used + cells > width - 1) break;
    kept += segment;
    used += cells;
  }
  return `${kept}…`;
}
