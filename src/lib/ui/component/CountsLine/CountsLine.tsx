import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { fitField, measureText } from "../../fit/index.js";
import type { CountsLineProps } from "./types.js";

/**
 * The line under the list: a summary of the list, and where the selection
 * is in it, against the right edge; never docket's own state (that is the
 * status line's). The position keeps its cells, and the summary's
 * parts, `3 over · 2 soon · 6 on track`, are docket's words and are never
 * cut: when they do not all fit, they leave whole from the least urgent,
 * `on track` first, then `soon`, and `over` last.
 *
 * `import { CountsLine } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.counts_line
 */
const CountsLine = ({
  summary,
  position,
  width,
}: CountsLineProps): ReactNode => {
  const place = position ? fitField(position, "line", width) : "";
  const room = place === "" ? width : width - measureText(place) - 1;
  const separator = ` ${tokens["glyph.separator"]} `;
  const parts = summary.text
    .split(separator)
    .map((text) => fitField({ ...summary, text }, "line", width));
  while (parts.length > 0 && measureText(parts.join(separator)) > room) {
    parts.pop();
  }
  const counts = parts.join(separator);
  const gap = width - measureText(counts) - measureText(place);
  return (
    <text fg={tokens["color.text"]}>
      {counts}
      {place && " ".repeat(Math.max(1, gap))}
      {place}
    </text>
  );
};

export default CountsLine;
