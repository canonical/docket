import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { fitField, measureText } from "../../fit/index.js";
import type { PaneHeaderProps } from "./types.js";

/**
 * The first line of the pane. It says where you are: the current mode's
 * name on the left and that mode's own address on the right. It never
 * names the other mode; there is no tab strip. The mode's name never
 * gives way; the address's parts, `24h · by kind`, are docket's words and
 * are never cut: when they do not all fit, they leave whole, the first
 * part first, as the window leaves before the grouping.
 *
 * `import { PaneHeader } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.subcomponent.pane-header
 */
const PaneHeader = ({ title, address, width }: PaneHeaderProps): ReactNode => {
  const left = fitField(title, "line", width);
  const separator = ` ${tokens["glyph.separator"]} `;
  const parts = address
    ? address.text
        .split(separator)
        .map((text) => fitField({ ...address, text }, "line", width))
    : [];
  // A space at least between the mode and the address.
  while (
    parts.length > 0 &&
    measureText(left) + 1 + measureText(parts.join(separator)) > width
  ) {
    parts.shift();
  }
  const right = parts.join(separator);
  const gap = Math.max(0, width - measureText(left) - measureText(right));
  return (
    <text fg={tokens["color.text"]}>
      {left}
      {" ".repeat(gap)}
      {right}
    </text>
  );
};

export default PaneHeader;
