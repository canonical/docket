import type { ReactNode } from "react";
import type { ActivityList as List } from "../lib/activity/index.js";
import { ActivityRow, EventLine, GroupHeading } from "../lib/ui/index.js";

/** Props for the ActivityList component. */
export interface ActivityListProps {
  /** activity's groups, as the view model gives them for one address. */
  readonly list: List;
  /** The width of the pane, in display cells. */
  readonly width: number;
}

/**
 * activity's list region: each group's heading, when the list is grouped,
 * then each thread with its events nested under it, newest first. A
 * thread's events never leave it, whatever the grouping. The pane clips
 * what does not fit.
 */
export default function ActivityList({
  list,
  width,
}: ActivityListProps): ReactNode {
  return (
    <box flexDirection="column">
      {list.groups.map(({ heading, rows }) => (
        <box key={heading?.text ?? ""} flexDirection="column" flexShrink={0}>
          {heading && <GroupHeading text={heading.text} width={width} />}
          {rows.map((row) => (
            <box key={row.reference.text} flexDirection="column" flexShrink={0}>
              <ActivityRow row={row} width={width} />
              {row.events.map((line, index) => (
                <EventLine
                  // An event line holds no state, so its place is its key.
                  // biome-ignore lint/suspicious/noArrayIndexKey: see above.
                  key={index}
                  line={line}
                  width={width}
                />
              ))}
            </box>
          ))}
        </box>
      ))}
    </box>
  );
}
