import { type ReactNode, useEffect } from "react";
import type {
  ThreadRow as ActivityThread,
  ActivityList as List,
} from "../lib/activity/index.js";
import type { WaitRow } from "../lib/owed/index.js";
import {
  accordionHeight,
  countRowLines,
  EventLine,
  GroupHeading,
  type ShownDetail,
  ThreadAccordion,
  ThreadRow,
  useListScroll,
} from "../lib/ui/index.js";
import findThreadState from "./findThreadState.js";
import listWaiting from "./listWaiting.js";

/** Props for the ActivityList component. */
export interface ActivityListProps {
  /** activity's groups, as the view model gives them for one address. */
  readonly list: List;
  /** The place of the selected thread among the threads, in the order drawn. */
  readonly selected: number;
  /** Reads the details of the selected thread for its accordion. */
  readonly readDetail: (row: ActivityThread) => Promise<ShownDetail>;
  /**
   * Measures owed's rows of a thread and the other pull requests of its
   * stack, most pressing first, whose waits tell the selected thread's
   * accordion its current state and the kinds its stack lines name. Only
   * the selected thread is measured.
   */
  readonly measureWaits: (row: ActivityThread) => readonly WaitRow[];
  /** The instant ages are measured at. */
  readonly now: Date;
  /** The time zone a time of day is written in. */
  readonly timezone: string;
  /** The width of the pane, in display cells. */
  readonly width: number;
  /** The lines the list region has. */
  readonly height: number;
  /**
   * What stands in the accordion's place under the selected thread, such
   * as an editor, and the lines it takes. The row then gives up its
   * selection background to the option under the editor's cursor.
   */
  readonly editor?: { readonly node: ReactNode; readonly lines: number };
  /**
   * Told, after each draw, how many rows the list shows, headings not
   * counted, which is how far a page moves the selection.
   */
  readonly onShownRows: (rows: number) => void;
}

/**
 * One heading, or one thread with its events, and the accordion when it
 * is selected.
 */
interface Block {
  readonly key: string;
  /** Whether the block holds a row, rather than a heading. */
  readonly row: boolean;
  readonly lines: number;
  readonly node: ReactNode;
}

/**
 * activity's list region: each group's heading, when the list is grouped,
 * then each thread with its events nested under it, newest first. A
 * thread's events never leave it, whatever the grouping. The accordion
 * opens under the selected thread, above its events, with the thread's
 * current state. Only the threads move the selection, so a heading is
 * never selected. The list scrolls as little as it must to keep the
 * selected thread whole in view, with its group's heading when it is the
 * group's first thread.
 */
export default function ActivityList({
  list,
  selected,
  readDetail,
  measureWaits,
  now,
  timezone,
  width,
  height,
  editor,
  onShownRows,
}: ActivityListProps): ReactNode {
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
      const chosen = place === selected;
      const waits = chosen ? measureWaits(row) : [];
      if (chosen) {
        to = blocks.length;
        from = heading && row === rows.at(0) ? to - 1 : to;
      }
      blocks.push({
        key: row.reference.text,
        row: true,
        lines:
          countRowLines(row, width, chosen && !editor) +
          (chosen ? (editor?.lines ?? accordionHeight) : 0) +
          row.events.length,
        node: (
          <>
            <ThreadRow
              row={row}
              selected={chosen && !editor}
              continued={chosen && !editor}
              width={width}
            />
            {chosen && editor?.node}
            {chosen && !editor && (
              <ThreadAccordion
                row={findThreadState(row, waits)}
                detail={readDetail(row)}
                waiting={listWaiting(waits)}
                clock={false}
                now={now}
                timezone={timezone}
                width={width}
              />
            )}
            {row.events.map((line, index) => (
              <EventLine
                // An event line holds no state, so its place is its key.
                // biome-ignore lint/suspicious/noArrayIndexKey: see above.
                key={index}
                line={line}
                stacked={row.stacked}
                width={width}
              />
            ))}
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
