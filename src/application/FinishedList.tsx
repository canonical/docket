import type { ReactNode } from "react";
import type {
  FinishedRow,
  FinishedList as List,
} from "../lib/finished/index.js";
import {
  countAccordionLines,
  countRowLines,
  EventLine,
  GroupHeading,
  type ListBlock,
  ScrolledList,
  type ShownDetail,
  ThreadAccordion,
  ThreadRow,
  useDrawnLines,
} from "../lib/ui/index.js";

/** Props for the FinishedList component. */
export interface FinishedListProps {
  /** finished's groups, as the view model gives them for one address. */
  readonly list: List;
  /** The place of the selected thread among the threads, in the order drawn. */
  readonly selected: number;
  /**
   * Reads the details of the selected thread for its accordion, called
   * only for a pull request in a stack, whose neighbours wait on them; any
   * other finished thread's accordion comes whole from the list.
   */
  readonly readDetail: (row: FinishedRow) => Promise<ShownDetail>;
  /** The instant ages are measured at. */
  readonly now: Date;
  /** The time zone a time of day is written in. */
  readonly timezone: string;
  /** The width of the pane, in display cells. */
  readonly width: number;
  /** The lines the list region has. */
  readonly height: number;
  /**
   * Told, after each draw, how many rows the list shows, headings not
   * counted, which is how far a page moves the selection, and the place
   * of the first block it shows, which `firstShown` takes when the list
   * is drawn anew.
   */
  readonly onShownRows: (rows: number, first: number) => void;
  /**
   * The place of the first block shown when the list is drawn anew, such
   * as after the help or a pane too small took its place.
   */
  readonly firstShown?: number;
}

/** No wait runs on a finished thread, so its stack's neighbours name their state. */
const waiting = {};

/**
 * finished's list region: each group's heading, when the list is
 * grouped, then each thread that finished, newest ending first, with its
 * ending as its one event under it. The accordion opens under the
 * selected thread, above its ending, and the verdict's bar runs down the
 * whole item to the ending. Only the threads move the selection, so a
 * heading is never selected. The list scrolls as activity's does, through
 * the same scrolled list.
 */
export default function FinishedList({
  list,
  selected,
  readDetail,
  now,
  timezone,
  width,
  height,
  onShownRows,
  firstShown,
}: FinishedListProps): ReactNode {
  const drawn = useDrawnLines();
  const reading = { now, timezone, waiting };
  const blocks: ListBlock[] = [];
  let place = 0;
  let from = 0;
  let to = 0;
  for (const { heading, rows } of list.groups) {
    if (heading) {
      const node = <GroupHeading heading={heading} width={width} />;
      blocks.push({
        key: heading.text,
        kind: "heading",
        lines: 1,
        node,
        heading,
      });
    }
    for (const row of rows) {
      const chosen = place === selected;
      const key = row.reference.text;
      if (chosen) {
        to = blocks.length;
        from = heading && row === rows.at(0) ? to - 1 : to;
      }
      blocks.push({
        key,
        kind: "row",
        lines:
          countRowLines(row, width, chosen) +
          (chosen
            ? drawn.measure(key, countAccordionLines(row, reading, width))
            : 0) +
          1,
        node: (
          <>
            <ThreadRow row={row} selected={chosen} continued width={width} />
            {chosen && (
              <ThreadAccordion
                row={row}
                {...(row.stacked && { detail: readDetail(row) })}
                waiting={waiting}
                clock
                now={now}
                timezone={timezone}
                width={width}
                onLines={drawn.report(key)}
              />
            )}
            <EventLine
              line={row.ending}
              {...(row.verdict && { state: row.verdict })}
              stacked={row.stacked}
              width={width}
            />
          </>
        ),
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
