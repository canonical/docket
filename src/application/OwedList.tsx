import type { ReactNode } from "react";
import {
  type OwedList as List,
  nameHeading,
  type WaitRow,
} from "../lib/owed/index.js";
import {
  countAccordionLines,
  countRowLines,
  GroupHeading,
  type ListBlock,
  Notice,
  ScrolledList,
  type ShownDetail,
  ThreadAccordion,
  ThreadRow,
  useDrawnLines,
  wrapNotice,
} from "../lib/ui/index.js";
import identifyRow from "./identifyRow.js";
import listWaiting from "./listWaiting.js";

/** What the list draws, and where. */
export interface OwedListProps {
  readonly list: List;
  /** The place of the selected row among the rows, in the order drawn. */
  readonly selected: number;
  /** Reads the details of the selected row's thread for its accordion. */
  readonly readDetail: (row: WaitRow) => Promise<ShownDetail>;
  /** The instant ages are measured at. */
  readonly now: Date;
  /** The time zone a time of day is written in. */
  readonly timezone: string;
  /** The width of the pane, in display cells. */
  readonly width: number;
  /** The lines the list region has. */
  readonly height: number;
  /**
   * A reason and its recovery that stay above the rows, such as the
   * settings listing no team, while the rows scroll beneath.
   */
  readonly notice?: { readonly reason: string; readonly recovery: string };
  /**
   * What stands in the accordion's place under the selected row, such as
   * an editor, and the lines it takes. The row then gives up its selection
   * background to the option under the editor's cursor.
   */
  readonly editor?: { readonly node: ReactNode; readonly lines: number };
  /**
   * Told, after each draw, how many rows the list shows, headings not
   * counted, which is how far a page moves the selection, and the place
   * of the first block it shows, heading or row, which `firstShown` takes
   * when the list is drawn anew.
   */
  readonly onShownRows: (rows: number, first: number) => void;
  /**
   * The place of the first block shown when the list is drawn anew, such
   * as after the help or a pane too small took its place.
   */
  readonly firstShown?: number;
}

/**
 * owed's list, under the notice when there is one: each group's heading,
 * then its rows, with the accordion open under the selected row. Only the
 * rows move the selection, so a heading is never selected. The list
 * scrolls as little as it must to keep the selected row and its accordion
 * whole in view, with its group's heading when it is the group's first
 * row, and the heading of the group under its first line pinned there;
 * the notice stays put.
 */
export default function OwedList({
  list,
  selected,
  readDetail,
  now,
  timezone,
  width,
  height,
  notice,
  editor,
  onShownRows,
  firstShown,
}: OwedListProps): ReactNode {
  const waiting = listWaiting(list.groups.flatMap((group) => group.rows));
  const drawn = useDrawnLines();
  const blocks: ListBlock[] = [];
  let place = 0;
  let from = 0;
  let to = 0;
  for (const { heading, rows } of list.groups) {
    if (heading) {
      const node = <GroupHeading heading={heading} width={width} />;
      blocks.push({
        key: nameHeading(heading),
        kind: "heading",
        lines: 1,
        node,
        heading,
      });
    }
    for (const row of rows) {
      const open = place === selected;
      if (open) {
        to = blocks.length;
        from = heading && row === rows.at(0) ? to - 1 : to;
      }
      blocks.push({
        key: `${heading ? nameHeading(heading) : ""} ${identifyRow(row)}`,
        kind: "row",
        lines:
          countRowLines(row, width, open && !editor) +
          (open
            ? (editor?.lines ??
              drawn.measure(
                identifyRow(row),
                countAccordionLines(row, { now, timezone, waiting }, width),
              ))
            : 0),
        node: (
          <>
            <ThreadRow
              row={row}
              selected={open && !editor}
              continued={open && !editor}
              width={width}
            />
            {open && editor?.node}
            {open && !editor && (
              <ThreadAccordion
                row={row}
                detail={readDetail(row)}
                waiting={waiting}
                clock
                now={now}
                timezone={timezone}
                width={width}
                onLines={drawn.report(identifyRow(row))}
              />
            )}
          </>
        ),
      });
      place += 1;
    }
  }
  // The notice draws two cells in, as it does in place of the list.
  const noticeLines = notice
    ? Object.values(
        wrapNotice(notice.reason, notice.recovery, width - 2),
      ).flat().length
    : 0;
  // The notice and the rows each have a box of their own lines, so a
  // selected row taller than the room left is cut at the bottom, and a
  // box never gives up lines to the other, which would draw the notice's
  // lines over one another. A region shorter than the notice cuts it.
  return (
    <box flexDirection="column" height={height} overflow="hidden">
      {notice && (
        <box
          flexDirection="column"
          flexShrink={0}
          height={Math.min(noticeLines, height)}
          overflow="hidden"
        >
          <box flexShrink={0}>
            <Notice {...notice} width={width} />
          </box>
        </box>
      )}
      <box flexShrink={0}>
        <ScrolledList
          blocks={blocks}
          from={from}
          to={to}
          height={Math.max(height - noticeLines, 0)}
          first={firstShown}
          onShown={onShownRows}
          width={width}
        />
      </box>
    </box>
  );
}
