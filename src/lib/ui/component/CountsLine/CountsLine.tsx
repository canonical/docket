import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import trimText from "../../trimText.js";
import type { CountsLineProps } from "./types.js";

/**
 * The line under the list: a summary of the list, and where the selection
 * is in it, against the right edge; never docket's own state (that is the
 * status line's). The position keeps its cells, and the summary is cut
 * first.
 *
 * `import { CountsLine } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.counts_line
 */
const CountsLine = ({
  summary,
  position = "",
  width,
}: CountsLineProps): ReactNode => {
  const place = trimText(position, width);
  const room = place === "" ? width : width - Bun.stringWidth(place) - 1;
  const counts = trimText(summary, Math.max(0, room));
  const gap = width - Bun.stringWidth(counts) - Bun.stringWidth(place);
  return (
    <text fg={tokens["color.text"]}>
      {counts}
      {place && " ".repeat(Math.max(1, gap))}
      {place}
    </text>
  );
};

export default CountsLine;
