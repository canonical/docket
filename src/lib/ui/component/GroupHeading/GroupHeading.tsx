import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { markPerson, measureText } from "../../fit/index.js";
import type { GroupHeadingProps } from "./types.js";

/**
 * One line naming a group in the list: its name, a space, then a `─` rule
 * to the pane's edge. The rule is horizontal on purpose: the item's bar is
 * vertical, so the two strokes read as two structures, a section and an
 * item. A person's heading keeps their group's mark and hue; CAPITALS are
 * docket's own section names, never a name from GitHub. Pinned above its
 * rows while they scroll, it gives the group's count after the name,
 * `● bob · 3 of 5`, plain. The name is trimmed so the count and a rule
 * always follow it, and it is never bold: bold is a row's first line. The
 * help reuses the heading for its object headings. The selection never
 * lands on a heading, so it has no selected state and takes no
 * background.
 *
 * `import { GroupHeading } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.group_heading
 */
const GroupHeading = ({
  heading,
  count,
  width,
}: GroupHeadingProps): ReactNode => {
  const counted = count === undefined ? "" : ` · ${count}`;
  // A space and one cell of rule always follow the name and its count,
  // and a person's mark and its space come before the login.
  const mark = "group" in heading ? 2 : 0;
  const name = markPerson(heading, width - 2 - mark - measureText(counted));
  const rule = width - measureText(name.text) - measureText(counted) - 1;
  return (
    <text>
      <span fg={name.fg}>{name.text}</span>
      <span fg={tokens["color.text"]}>
        {`${counted} ${tokens["glyph.rule"].repeat(Math.max(1, rule))}`}
      </span>
    </text>
  );
};

export default GroupHeading;
