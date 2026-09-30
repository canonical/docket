import { sanitize } from "../../text/index.js";
import { graphemes } from "./constants.js";
import measureText from "./measureText.js";

/** A space that joins two words so no line breaks between them. */
const joiner = " ";

/**
 * Splits a word too wide for a line into pieces that fit, between its
 * characters, so wrapped text never loses one nor breaks one apart. A
 * piece holds one character at least, however narrow the line.
 */
function splitWord(word: string, width: number): string[] {
  if (measureText(word) <= width) return [word];
  const pieces: string[] = [""];
  let used = 0;
  for (const { segment } of graphemes.segment(word)) {
    const cells = measureText(segment);
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
 * first, and flows a line break as a space.
 */
export default function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  const words = sanitize(text)
    .split(" ")
    .flatMap((word) => splitWord(word, width));
  for (const word of words) {
    if (line === "") line = word;
    else if (measureText(`${line} ${word}`) <= width) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines.map((each) => each.replaceAll(joiner, " "));
}
