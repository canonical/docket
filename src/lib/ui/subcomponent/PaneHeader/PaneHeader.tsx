import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { fitField } from "../../fit/index.js";
import type { PaneHeaderProps } from "./types.js";

/**
 * The first line of the pane. It says where you are: the current mode's
 * name on the left and that mode's own address on the right. It never
 * names the other mode; there is no tab strip.
 *
 * `import { PaneHeader } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.subcomponent.pane-header
 */
const PaneHeader = ({ title, address, width }: PaneHeaderProps): ReactNode => {
  const left = fitField(title, "line", width);
  const right = address
    ? fitField(address, "line", width - Bun.stringWidth(left) - 1)
    : "";
  const gap = Math.max(
    0,
    width - Bun.stringWidth(left) - Bun.stringWidth(right),
  );
  return (
    <text fg={tokens["color.text"]}>
      {left}
      {" ".repeat(gap)}
      {right}
    </text>
  );
};

export default PaneHeader;
