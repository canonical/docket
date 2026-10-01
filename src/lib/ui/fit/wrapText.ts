import { sanitize } from "../../text/index.js";
import { graphemes, noBreakSpace } from "./constants.js";
import measureCluster from "./measureCluster.js";
import measureOnce from "./measureOnce.js";

/**
 * Splits a word too wide for a line into pieces that fit, between its
 * characters, so wrapped text never loses one nor breaks one apart. A
 * piece holds one character at least, however narrow the line.
 */
function splitWord(word: string, width: number): string[] {
  if (measureOnce(word) <= width) return [word];
  const pieces: string[] = [""];
  let used = 0;
  for (const { segment } of graphemes.segment(word)) {
    const cells = measureCluster(segment);
    if (used > 0 && used + cells > width) {
      pieces.push("");
      used = 0;
    }
    pieces.push(`${pieces.pop()}${segment}`);
    used += cells;
  }
  return pieces;
}

/**
 * Wraps `text` into lines of at most `width` display cells, breaking only
 * at spaces. Words joined by a no-break space stay on one line and are
 * shown with an ordinary space; a single word wider than a line is split.
 * As `trimText` does, it removes escape sequences and control characters
 * first, and flows a line break as a space. Its words and growing lines
 * are measured with `measureOnce`, so a long message keeps no text.
 */
export default function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  const words = sanitize(text)
    .split(" ")
    .flatMap((word) => splitWord(word, width));
  for (const word of words) {
    if (line === "") line = word;
    else if (measureOnce(`${line} ${word}`) <= width) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines.map((each) => each.replaceAll(noBreakSpace, " "));
}
