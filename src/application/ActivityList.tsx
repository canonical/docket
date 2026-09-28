import { type ReactNode, useState } from "react";
import type {
  ThreadRow as ActivityThread,
  ActivityList as List,
} from "../lib/activity/index.js";
import type { WaitRow } from "../lib/owed/index.js";
import type { ThreadDetail } from "../lib/provider/index.js";
import {
  accordionHeight,
  countRowLines,
  EventLine,
  GroupHeading,
  keepInView,
  ThreadAccordion,
  ThreadRow,
} from "../lib/ui/index.js";
import type { Thread } from "../lib/waits/index.js";
import findThreadState from "./findThreadState.js";
import listWaiting from "./listWaiting.js";

/** Props for the ActivityList component. */
export interface ActivityListProps {
  /** activity's groups, as the view model gives them for one address. */
  readonly list: List;
  /** The place of the selected thread among the threads, in the order drawn. */
  readonly selected: number;
  /** Reads the details of the selected thread for its accordion. */
  readonly readDetail: (row: ActivityThread) => Promise<ThreadDetail>;
  /**
   * owed's rows, most pressing first, whose waits tell the accordion
   * each thread's current state.
   */
  readonly waits: readonly WaitRow[];
  /** The cached threads, whose facts the accordion shows for a thread at rest. */
  readonly threads: readonly Thread[];
  /** The instant ages are measured at. */
  readonly now: Date;
  /** The time zone a time of day is written in. */
  readonly timezone: string;
  /** The width of the pane, in display cells. */
  readonly width: number;
  /** The lines the list region has. */
  readonly height: number;
}

/**
 * One heading, or one thread with its events, and the accordion when it
 * is selected.
 */
interface Block {
  readonly key: string;
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
  waits,
  threads,
  now,
  timezone,
  width,
  height,
}: ActivityListProps): ReactNode {
  const [first, setFirst] = useState(0);
  const waiting = listWaiting(waits);
  const blocks: Block[] = [];
  let place = 0;
  let from = 0;
  let to = 0;
  for (const { heading, rows } of list.groups) {
    if (heading) {
      const node = <GroupHeading text={heading.text} width={width} />;
      blocks.push({ key: heading.text, lines: 1, node });
    }
    for (const row of rows) {
      const chosen = place === selected;
      if (chosen) {
        to = blocks.length;
        from = heading && row === rows.at(0) ? to - 1 : to;
      }
      blocks.push({
        key: row.reference.text,
        lines:
          countRowLines(row, width) +
          (chosen ? accordionHeight : 0) +
          row.events.length,
        node: (
          <>
            <ThreadRow row={row} selected={chosen} width={width} />
            {chosen && (
              <ThreadAccordion
                row={findThreadState(row, waits, threads)}
                detail={readDetail(row)}
                waiting={waiting}
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
                width={width}
              />
            ))}
          </>
        ),
      });
      place += 1;
    }
  }
  const top = keepInView(
    blocks.map(({ lines }) => lines),
    from,
    to,
    height,
    first,
  );
  // The first block shown is remembered from the frame before, so the list
  // only scrolls when the selection would leave it.
  if (top !== first) setFirst(top);
  // Whole blocks only, as many as fit: a thread is never drawn without its
  // second line. The first is drawn whatever its height, cut by the region.
  let used = 0;
  const shown = blocks.slice(top).filter(({ lines }, index) => {
    used += lines;
    return index === 0 || used <= height;
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
