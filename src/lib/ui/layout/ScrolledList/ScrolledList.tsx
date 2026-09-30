import { type ReactNode, useEffect } from "react";
import { tokens } from "../../../tokens/index.js";
import { GroupHeading } from "../../component/GroupHeading/index.js";
import { useListScroll } from "../../hooks/index.js";
import type { ScrolledListProps } from "./types.js";

/**
 * The pane's list region: the list is the only part that grows or
 * shrinks with the terminal, and it clips what does not fit rather than
 * scrolling on its own. It shows the selection whole where the room
 * allows (`useListScroll`). While the first line shows a row of a group,
 * that group's heading is pinned there with the place of the row in the
 * group, `● bob · 3 of 5`, and the next group's heading replaces it as it
 * arrives. When rows are cut off below, the last line counts them all, in
 * whichever group, dimmed as context, `↓ 12 below`. owed's and
 * activity's lists are drawn through it, and the help is scrolled by it
 * too.
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
            count={`${pinned.place} of ${pinned.size}`}
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
          {`  ${tokens["glyph.below"]} ${below} below`}
        </text>
      )}
    </box>
  );
};

export default ScrolledList;
