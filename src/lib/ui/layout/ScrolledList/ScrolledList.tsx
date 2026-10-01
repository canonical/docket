import { type ReactNode, useEffect } from "react";
import { tokens } from "../../../tokens/index.js";
import { GroupHeading } from "../../component/GroupHeading/index.js";
import { fitField } from "../../fit/index.js";
import { useListScroll } from "../../hooks/index.js";
import type { ScrolledListProps } from "./types.js";

/**
 * The list is the only part that grows; the three lines under it keep
 * their height. The region is the scrolled list: it keeps the selection
 * whole where the room allows, pins the heading of the group under its
 * first line, and counts the rows below. The help overlay is scrolled by
 * the same rules.
 *
 * `import { ScrolledList } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.layout.pane
 */
const ScrolledList = ({
  blocks,
  from,
  to,
  height,
  first: firstShown,
  onShown,
  width,
}: ScrolledListProps): ReactNode => {
  const { shown, first, pinned, below } = useListScroll({
    blocks,
    from,
    to,
    room: height,
    first: firstShown,
  });
  const rows = shown.filter(({ kind }) => kind === "row").length;
  useEffect(() => {
    onShown(rows, first);
  });
  return (
    <box flexDirection="column" height={height} overflow="hidden">
      {pinned && (
        <box flexShrink={0}>
          <GroupHeading
            heading={pinned.heading}
            count={{
              text: `${pinned.place} of ${pinned.size}`,
              kind: "figure",
            }}
            width={width}
          />
        </box>
      )}
      <box
        flexDirection="column"
        flexShrink={0}
        height={Math.max(0, height - (pinned ? 1 : 0) - (below > 0 ? 1 : 0))}
        overflow="hidden"
      >
        {shown.map(({ key, node }) => (
          <box key={key} flexDirection="column" flexShrink={0}>
            {node}
          </box>
        ))}
      </box>
      {below > 0 && (
        <text flexShrink={0} fg={tokens["color.text.muted"]}>
          {fitField(
            {
              text: `  ${tokens["glyph.below"]} ${below} below`,
              kind: "figure",
            },
            "line",
            width,
          )}
        </text>
      )}
    </box>
  );
};

export default ScrolledList;
