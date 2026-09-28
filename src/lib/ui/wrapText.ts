import trimText from "./trimText.js";

/** A space that joins two words so no line breaks between them. */
const joiner = " ";

/**
 * Splits a word too wide for a line into pieces that fit, so wrapped text
 * never loses a character.
 */
function splitWord(word: string, width: number): string[] {
  const pieces: string[] = [];
  let rest = word;
  while (Bun.stringWidth(rest) > width) {
    const piece = trimText(rest, width + 1).slice(0, -1);
    pieces.push(piece);
    rest = rest.slice(piece.length);
  }
  return [...pieces, rest];
}

/**
 * Wraps `text` into lines of at most `width` display cells, breaking only
 * at spaces. Words joined by a no-break space stay on one line and are
 * shown with an ordinary space; a single word wider than a line is split.
 */
export default function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ").flatMap((w) => splitWord(w, width))) {
    if (line === "") line = word;
    else if (Bun.stringWidth(`${line} ${word}`) <= width)
      line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines.map((each) => each.replaceAll(joiner, " "));
}
