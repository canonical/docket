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
 * The buffers every character is measured in, one for each method, made
 * on the first character that is not plain ASCII and kept for the life
 * of the process.
 */
let measuring: readonly Measuring[] | undefined;

/** The cells of each character measured so far, which every draw reads. */
const measured = new Map<string, number>();

/** The widest line a character is measured on, far wider than any. */
const measureWidth = 1024;

/**
 * The cells one character, a grapheme cluster, takes: plain ASCII one;
 * any other the wider of what OpenTUI's own text buffer counts for it in
 * its two width methods, `wcwidth` and `unicode`. A line fitted with it
 * never runs past its width in either kind of terminal, and may stop a
 * cell short in one.
 *
 * @note Impure: it keeps the text buffers and each answer for the life of
 * the process, and measures through OpenTUI's native library.
 */
export default function measureCluster(cluster: string): number {
  if (cluster.length === 1 && cluster >= " " && cluster <= "~") return 1;
  const known = measured.get(cluster);
  if (known !== undefined) return known;
  measuring ??= methods.map((method) => {
    const buffer = TextBuffer.create(method);
    const view = TextBufferView.create(buffer);
    view.setWrapMode("none");
    return { buffer, view };
  });
  let cells = 0;
  for (const { buffer, view } of measuring) {
    buffer.setText(cluster);
    const result = view.measureForDimensions(measureWidth, 1);
    // The native library gives no measure only when it fails, such as when
    // it cannot allocate; Bun's measure then stands in, and is not kept.
    if (result === null) return Bun.stringWidth(cluster);
    cells = Math.max(cells, result.widthColsMax);
  }
  measured.set(cluster, cells);
  return cells;
}
