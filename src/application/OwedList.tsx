import { type ReactNode, useState } from "react";
import type { OwedList as List, WaitRow } from "../lib/owed/index.js";
import type { ThreadDetail } from "../lib/provider/index.js";
import {
  accordionHeight,
  countRowLines,
  GroupHeading,
  keepInView,
  ThreadAccordion,
  ThreadRow,
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
}

/** One heading, or one row with the accordion when it is selected. */
interface Block {
  readonly key: string;
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
}: OwedListProps): ReactNode {
  const [first, setFirst] = useState(0);
  const waiting = listWaiting(list.groups.flatMap((group) => group.rows));
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
      const open = place === selected;
      if (open) {
        to = blocks.length;
        from = heading && row === rows.at(0) ? to - 1 : to;
      }
      blocks.push({
        key: `${heading?.text ?? ""} ${identifyRow(row)}`,
        lines: countRowLines(row, width) + (open ? accordionHeight : 0),
        node: (
          <>
            <ThreadRow row={row} selected={open} width={width} />
            {open && (
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
  // Whole blocks only, as many as fit: a row is never drawn without its
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
