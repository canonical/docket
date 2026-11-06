import type { ReactNode } from "react";
import type { InboxList as List } from "../lib/inbox/index.js";
import {
  GroupHeading,
  InboxRow,
  type ListBlock,
  ScrolledList,
} from "../lib/ui/index.js";

/** Props for the InboxList component. */
export interface InboxListProps {
  /** The inbox's groups, as the view model gives them for one address. */
  readonly list: List;
  /** The place of the selected notification among the notifications drawn. */
  readonly selected: number;
  /** The width of the pane, in display cells. */
  readonly width: number;
  /** The lines the list region has. */
  readonly height: number;
  /**
   * Told, after each draw, how many notifications the list shows, headings
   * not counted, which is how far a page moves the selection, and the place
   * of the first block it shows.
   */
  readonly onShownRows: (rows: number, first: number) => void;
  /** The place of the first block shown when the list is drawn anew. */
  readonly firstShown?: number;
}

/**
 * The inbox's list region: each group's heading, when the inbox is
 * grouped, then each notification on its two lines, unread first. Only
 * notifications move the selection, so a heading is never selected. The
 * list scrolls as little as it must to keep the selected notification
 * whole in view, with its group's heading when it leads its group.
 */
export default function InboxList({
  list,
  selected,
  width,
  height,
  onShownRows,
  firstShown,
}: InboxListProps): ReactNode {
  const blocks: ListBlock[] = [];
  let place = 0;
  let from = 0;
  let to = 0;
  for (const { heading, rows } of list.groups) {
    if (heading) {
      blocks.push({
        key: heading.text,
        kind: "heading",
        lines: 1,
        node: <GroupHeading heading={heading} width={width} />,
        heading,
      });
    }
    for (const row of rows) {
      const chosen = place === selected;
      if (chosen) {
        to = blocks.length;
        from = heading && row === rows.at(0) ? to - 1 : to;
      }
      blocks.push({
        key: row.notification.id,
        kind: "row",
        lines: 2,
        node: () => <InboxRow row={row} selected={chosen} width={width} />,
      });
      place += 1;
    }
  }
  return (
    <ScrolledList
      blocks={blocks}
      from={from}
      to={to}
      height={height}
      first={firstShown}
      onShown={onShownRows}
      width={width}
    />
  );
}
