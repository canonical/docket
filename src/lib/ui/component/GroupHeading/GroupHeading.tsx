import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import trimText from "../../trimText.js";
import type { GroupHeadingProps } from "./types.js";

/**
 * One line naming a group in the list: an owner login, a repo, a stack,
 * `NOT IN A STACK`, or a kind. The help reuses it for its object
 * headings. Trimmed, never wrapped. The selection never lands on a
 * heading, so it has no selected state and takes no background.
 *
 * `import { GroupHeading } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.group_heading
 */
const GroupHeading = ({ text, width }: GroupHeadingProps): ReactNode => (
  <text fg={tokens["color.text"]} attributes={tokens["typography.weight.bold"]}>
    {trimText(text, width)}
  </text>
);

export default GroupHeading;
