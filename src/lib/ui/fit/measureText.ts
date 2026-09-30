import { resolveRenderLib } from "@opentui/core";
import { graphemes } from "./constants.js";

/** The cells of each character measured so far, which every draw reads again. */
const measured = new Map<string, number>();

/** One character of printable ASCII, which takes one cell everywhere. */
const ascii = /^[\x20-\x7e]$/;

/** The cells OpenTUI gives one code point, as it encodes it for drawing. */
function measureCodePoint(point: string): number {
  const library = resolveRenderLib();
  const encoded = library.encodeUnicode(point, "unicode");
  // The native library gives no encoding only when it fails, such as when
  // it cannot allocate; Bun's measure then stands in.
  if (!encoded) return Bun.stringWidth(point);
  const cells = encoded.data.reduce((sum, { width }) => sum + width, 0);
  library.freeUnicode(encoded);
  return cells;
}

/**
 * The cells a character takes. A single code point takes what OpenTUI
 * gives it. A character of several, such as an emoji with a skin tone, a
 * flag or a letter with a combining mark, is drawn a cell apart for each
 * of its code points and one more, which is never narrower than OpenTUI
 * draws it: a line fitted to it never runs past its width.
 */
function measureGrapheme(grapheme: string): number {
  const known = measured.get(grapheme);
  if (known !== undefined) return known;
  const points = [...grapheme];
  const cells =
    points.length === 1
      ? measureCodePoint(grapheme)
      : points.reduce(
          (sum, point) => sum + Math.max(1, measureCodePoint(point)),
          1,
        );
  measured.set(grapheme, cells);
  return cells;
}

/**
 * The display cells `text` takes as OpenTUI draws it, character by
 * character: the one measure every fitting and every layout of the
 * terminal counts with, so a line fitted to its width is drawn within it.
 * Bun's own measure disagrees with OpenTUI on some text, such as `❤`,
 * which it counts one cell and OpenTUI draws two.
 */
export default function measureText(text: string): number {
  let cells = 0;
  for (const { segment } of graphemes.segment(text)) {
    cells += ascii.test(segment) ? 1 : measureGrapheme(segment);
  }
  return cells;
}
