import { type ReactNode, useEffect } from "react";
import type { OwedList as List, WaitRow } from "../lib/owed/index.js";
import type { ThreadDetail } from "../lib/provider/index.js";
import {
  accordionHeight,
  countRowLines,
  GroupHeading,
  ThreadAccordion,
  ThreadRow,
  useListScroll,
} from "../lib/ui/index.js";
import identifyRow from "./identifyRow.js";
import listWaiting from "./listWaiting.js";

/** What the list draws, and where. */
export interface OwedListProps {
  readonly list: List;
  /** The place of the selected row among the rows, in the order drawn. */
  readonly selected: number;
  /** Reads the details of the selected row's thread for its accordion. */
  readonly readDetail: (row: WaitRow) => Promise<ThreadDetail>;
  /** The instant ages are measured at. */
  readonly now: Date;
  /** The time zone a time of day is written in. */
  readonly timezone: string;
  /** The width of the pane, in display cells. */
  readonly width: number;
  /** The lines the list region has. */
  readonly height: number;
  /**
   * What stands in the accordion's place under the selected row, such as
   * an editor, and the lines it takes. The row then gives up its selection
   * background to the option under the editor's cursor.
   */
  readonly editor?: { readonly node: ReactNode; readonly lines: number };
  /**
   * Told, after each draw, how many rows the list shows, headings not
   * counted, which is how far a page moves the selection.
   */
  readonly onShownRows: (rows: number) => void;
}

/** One heading, or one row with the accordion when it is selected. */
interface Block {
  readonly key: string;
  /** Whether the block holds a row, rather than a heading. */
  readonly row: boolean;
  readonly lines: number;
  readonly node: ReactNode;
}

/**
 * owed's list: each group's heading, then its rows, with the accordion
 * open under the selected row. Only the rows move the selection, so a
 * heading is never selected. The list scrolls as little as it must to
 * keep the selected row and its accordion whole in view, with its
 * group's heading when it is the group's first row.
 */
export default function OwedList({
  list,
  selected,
  readDetail,
  now,
  timezone,
  width,
  height,
  editor,
  onShownRows,
}: OwedListProps): ReactNode {
  const waiting = listWaiting(list.groups.flatMap((group) => group.rows));
  const blocks: Block[] = [];
  let place = 0;
  let from = 0;
  let to = 0;
  for (const { heading, rows } of list.groups) {
    if (heading) {
      const node = <GroupHeading text={heading.text} width={width} />;
      blocks.push({ key: heading.text, row: false, lines: 1, node });
    }
    for (const row of rows) {
      const open = place === selected;
      if (open) {
        to = blocks.length;
        from = heading && row === rows.at(0) ? to - 1 : to;
      }
      blocks.push({
        key: `${heading?.text ?? ""} ${identifyRow(row)}`,
        row: true,
        lines:
          countRowLines(row, width) +
          (open ? (editor?.lines ?? accordionHeight) : 0),
        node: (
          <>
            <ThreadRow row={row} selected={open && !editor} width={width} />
            {open && editor?.node}
            {open && !editor && (
              <ThreadAccordion
                row={row}
                detail={readDetail(row)}
                waiting={waiting}
                now={now}
                timezone={timezone}
                width={width}
              />
            )}
          </>
        ),
      });
      place += 1;
    }
  }
  const shown = useListScroll({ blocks, from, to, room: height });
  const shownRows = shown.filter(({ row }) => row).length;
  useEffect(() => {
    onShownRows(shownRows);
  });
  return (
    <box flexDirection="column" height={height} overflow="hidden">
      {shown.map(({ key, node }) => (
        <box key={key} flexDirection="column" flexShrink={0}>
          {node}
        </box>
      ))}
    </box>
  );
}
