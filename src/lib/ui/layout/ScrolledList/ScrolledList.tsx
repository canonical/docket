import { type ReactNode, useEffect } from "react";
import { GroupHeading } from "../../component/index.js";
import { useListScroll } from "../../hooks/index.js";
import type { ScrolledListProps } from "./types.js";

/**
 * A list of blocks in a region of its own lines, scrolled as little as it
 * must to keep the selection whole in view (`useListScroll`). While the
 * first line shows a row of a group, that group's heading is pinned there
 * with the place of the row in the group, `● bob · 3 of 5`, and the next
 * group's heading replaces it as it arrives. owed's and activity's lists
 * are drawn through it, and the help is scrolled by it too.
 *
 * `import { ScrolledList } from "../lib/ui/index.js";`
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
  const { shown, first, pinned } = useListScroll({
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
      {pinned?.heading.heading && (
        <box flexShrink={0}>
          <GroupHeading
            heading={pinned.heading.heading}
            count={`${pinned.place} of ${pinned.size}`}
            width={width}
          />
        </box>
      )}
      {shown.map(({ key, node }) => (
        <box key={key} flexDirection="column" flexShrink={0}>
          {node}
        </box>
      ))}
    </box>
  );
};

export default ScrolledList;
