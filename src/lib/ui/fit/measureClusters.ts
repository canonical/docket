import { TextBuffer, TextBufferView, type WidthMethod } from "@opentui/core";

/** OpenTUI's own text buffer and a view over it, which measure as it draws. */
interface Measuring {
  readonly buffer: TextBuffer;
  readonly view: TextBufferView;
}

/**
 * OpenTUI's two ways of counting a character's cells: `wcwidth`, a cell
 * count for each code point, which a terminal draws with unless it says
 * it draws clusters itself, and `unicode`, a count for each cluster,
 * which OpenTUI's renderer switches to when it does.
 */
const methods: readonly WidthMethod[] = ["wcwidth", "unicode"];

/**
 * The buffers characters are measured in, one for each method, made on
 * the first character that is not plain ASCII and kept for the life of
 * the process.
 */
let measuring: readonly Measuring[] | undefined;

/** The cells of each character measured so far, which every draw reads. */
const measured = new Map<string, number>();

/** One printable ASCII character, which takes one cell. */
const ascii = /^[\x20-\x7e]$/;

/** A line break, which takes no cell and would split a batch's lines. */
const lineBreak = /[\n\r]|\p{Zl}|\p{Zp}/u;

/**
 * The cells of each character in `clusters`, grapheme clusters, in
 * order: plain ASCII one; a line break none; any other the wider of what
 * OpenTUI's own text buffer counts for it in its two width methods,
 * `wcwidth` and `unicode`. A line fitted with them never runs past its
 * width in either kind of terminal, and may stop short of it in one.
 * The characters not measured before are measured together, one line
 * each, in one pass of each buffer, which is emptied first, so it never
 * grows.
 *
 * @note Impure: it keeps the text buffers and each answer for the life of
 * the process, and measures through OpenTUI's native library.
 */
export default function measureClusters(clusters: readonly string[]): number[] {
  const fresh = [
    ...new Set(
      clusters.filter(
        (cluster) =>
          !ascii.test(cluster) &&
          !lineBreak.test(cluster) &&
          !measured.has(cluster),
      ),
    ),
  ];
  if (fresh.length > 0) {
    measuring ??= methods.map((method) => {
      const buffer = TextBuffer.create(method);
      const view = TextBufferView.create(buffer);
      view.setWrapMode("none");
      return { buffer, view };
    });
    const widths = measuring.map(({ buffer, view }) => {
      buffer.reset();
      buffer.setText(fresh.join("\n"));
      return view.lineInfo.lineWidthCols;
    });
    fresh.forEach((cluster, line) => {
      measured.set(
        cluster,
        Math.max(...widths.map((each) => Number(each.at(line)))),
      );
    });
  }
  return clusters.map((cluster) =>
    ascii.test(cluster) ? 1 : (measured.get(cluster) ?? 0),
  );
}
