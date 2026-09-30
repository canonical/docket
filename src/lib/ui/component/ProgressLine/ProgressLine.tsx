import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import type { ProgressLineProps } from "./types.js";

/** The cells the bar takes when the line has room for them. */
const barCells = 29;

/**
 * The bar shown in the list area on a first run, under `refresh in
 * progress…`: `██████████████░░░░░░░░░░░░ 50/89 pages`, the pages read across
 * the repositories begun, so the total grows as each begins.
 *
 * `import { ProgressLine } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.progress_line
 */
const ProgressLine = ({
  fetched,
  total,
  width,
}: ProgressLineProps): ReactNode => {
  const fraction = `${fetched}/${total} pages`;
  const cells = Math.max(
    0,
    Math.min(barCells, width - Bun.stringWidth(fraction) - 1),
  );
  const filled = Math.min(cells, Math.floor((cells * fetched) / total));
  return (
    <text fg={tokens["color.text"]}>
      {tokens["glyph.progress.filled"].repeat(filled)}
      {tokens["glyph.progress.unfilled"].repeat(cells - filled)} {fraction}
    </text>
  );
};

export default ProgressLine;
