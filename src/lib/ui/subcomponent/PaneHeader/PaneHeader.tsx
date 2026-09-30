import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import trimText from "../../trimText.js";
import type { PaneHeaderProps } from "./types.js";

/** What joins the address and the sort. */
const joint = " · ";

/**
 * The first line of the pane. It says where you are: the current mode's
 * name on the left and that mode's own address on the right, read like
 * the text address, then its fixed sort, dimmed, as context. It never
 * names the other mode; there is no tab strip. When the line is too
 * short for them all, the sort gives way first, then the address is cut,
 * and the mode's name stays.
 *
 * `import { PaneHeader } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.subcomponent.pane-header
 */
const PaneHeader = ({
  title,
  address = "",
  sort = "",
  width,
}: PaneHeaderProps): ReactNode => {
  const left = trimText(title, width);
  const room = width - Bun.stringWidth(left) - 1;
  const sorted = `${joint}${sort}`;
  const fits =
    sort !== "" && Bun.stringWidth(address) + Bun.stringWidth(sorted) <= room;
  const right = trimText(address, room);
  const gap = Math.max(
    0,
    width -
      Bun.stringWidth(left) -
      Bun.stringWidth(right) -
      (fits ? Bun.stringWidth(sorted) : 0),
  );
  return (
    <text fg={tokens["color.text"]}>
      {left}
      {" ".repeat(gap)}
      {right}
      {fits && (
        <>
          {joint}
          <span fg={tokens["color.text.muted"]}>{sort}</span>
        </>
      )}
    </text>
  );
};

export default PaneHeader;
