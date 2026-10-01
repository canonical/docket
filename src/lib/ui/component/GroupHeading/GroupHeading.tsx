import type { ReactNode } from "react";
import type { StackHeading } from "../../../owed/index.js";
import { tokens } from "../../../tokens/index.js";
import { fitField, markPerson, measureText } from "../../fit/index.js";
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
/**
 * A stack's heading in `room` cells, fitted as a stack's place is: its
 * repository's short name leaves whole first, then its base branch is cut
 * once in its middle, and `stack 3 · 3 PRs →` stays whole, in any pane
 * the terminal draws.
 */
function fitStack(
  { repo, place, base }: StackHeading["stack"],
  room: number,
): string {
  const named = `${repo} ${place}`;
  // Below the narrowest pane even docket's words cannot stay whole.
  if (measureText(place) + 1 > room) {
    return fitField(
      { text: `${named}${base}`, kind: "identifier" },
      "line",
      room,
    );
  }
  const lead = measureText(`${named}${base}`) <= room ? named : place;
  const fixed = fitField({ text: lead, kind: "figure" }, "line", room);
  const cells = room - measureText(fixed);
  return `${fixed}${fitField({ text: base, kind: "identifier" }, "line", cells)}`;
}

const GroupHeading = ({
  heading,
  count,
  width,
}: GroupHeadingProps): ReactNode => {
  const counted =
    count === undefined ? "" : ` · ${fitField(count, "line", width)}`;
  // A space and one cell of rule always follow the name and its count,
  // and a person's mark and its space come before the login.
  const mark = "group" in heading ? 2 : 0;
  const room = width - 2 - mark - measureText(counted);
  const name =
    "stack" in heading
      ? { text: fitStack(heading.stack, room), fg: tokens["color.text"] }
      : markPerson(heading, room);
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
