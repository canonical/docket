import { TextBuffer, TextBufferView } from "@opentui/core";

/** OpenTUI's own text buffer and a view over it, which measure as it draws. */
interface Measuring {
  readonly buffer: TextBuffer;
  readonly view: TextBufferView;
}

/**
 * The buffer every character is measured in, made on the first character
 * that is not plain ASCII and kept for the life of the process.
 */
let measuring: Measuring | undefined;

/** The cells of each character measured so far, which every draw reads. */
const measured = new Map<string, number>();

/** The widest line a character is measured on, far wider than any. */
const measureWidth = 1024;

/**
 * The cells one character, a grapheme cluster, takes as OpenTUI draws it.
 * Plain ASCII takes one cell; any other character is measured by
 * OpenTUI's own text buffer, with the width method its renderer uses
 * unless the terminal says it draws clusters itself (`wcwidth`), and the
 * answer is kept. Not pure: it keeps the buffer and the answers, and
 * calls OpenTUI's native library.
 */
export default function measureCluster(cluster: string): number {
  if (cluster.length === 1 && cluster >= " " && cluster <= "~") return 1;
  const known = measured.get(cluster);
  if (known !== undefined) return known;
  measuring ??= (() => {
    const buffer = TextBuffer.create("wcwidth");
    const view = TextBufferView.create(buffer);
    view.setWrapMode("none");
    return { buffer, view };
  })();
  measuring.buffer.setText(cluster);
  const result = measuring.view.measureForDimensions(measureWidth, 1);
  // The native library gives no measure only when it fails, such as when
  // it cannot allocate; Bun's measure then stands in, and is not kept.
  if (result === null) return Bun.stringWidth(cluster);
  measured.set(cluster, result.widthColsMax);
  return result.widthColsMax;
}
