import stringWidth from "string-width";

const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });

/**
 * Fits `text` into `width` display cells on one line: whole when it fits,
 * otherwise cut and ended with `…`. Width is counted in cells, not
 * characters, so a wide character such as an emoji counts as two.
 */
export default function trimText(text: string, width: number): string {
  if (stringWidth(text) <= width) return text;
  if (width <= 0) return "";
  let kept = "";
  let used = 0;
  for (const { segment } of graphemes.segment(text)) {
    const cells = stringWidth(segment);
    if (used + cells > width - 1) break;
    kept += segment;
    used += cells;
  }
  return `${kept}…`;
}
