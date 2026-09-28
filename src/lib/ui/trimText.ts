const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });

/**
 * Fits `text` into `width` display cells on one line: whole when it fits,
 * otherwise cut and ended with `…`. Width is counted in cells, not
 * characters, by Bun's own measure, which agrees with the cells OpenTUI
 * draws: a wide character such as an emoji takes two, an arrow such as
 * `↔` one.
 */
export default function trimText(text: string, width: number): string {
  if (Bun.stringWidth(text) <= width) return text;
  if (width <= 0) return "";
  let kept = "";
  let used = 0;
  for (const { segment } of graphemes.segment(text)) {
    const cells = Bun.stringWidth(segment);
    if (used + cells > width - 1) break;
    kept += segment;
    used += cells;
  }
  return `${kept}…`;
}
