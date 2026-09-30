import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { fitPieces, markPerson } from "../../fit/index.js";
import measurePieces from "../../measurePieces.js";
import type { Piece } from "../../types.js";
import describeDetails from "./describeDetails.js";
import describeStatus from "./describeStatus.js";
import type { StatusLineProps, StatusMessage } from "./types.js";

/**
 * The colour of each kind of message: an error, and an action that
 * failed, take the error colour beside their `✗`, an action that went
 * through takes the success colour beside its `✓`, and freshness is
 * context, so it is dimmed.
 */
const colours: Readonly<Record<StatusMessage["kind"], string>> = {
  error: tokens["color.text.error"],
  actionFailed: tokens["color.text.error"],
  action: tokens["color.text.success"],
  progress: tokens["color.text"],
  refreshing: tokens["color.text"],
  notice: tokens["color.text"],
  freshness: tokens["color.text.muted"],
};

/**
 * The message's runs: its words in its kind's colour, then the people it
 * names, each behind their group's mark and in its hue, as `✓ assigned
 * ◐ erin`.
 */
function describeRuns({ kind, text, people = [] }: StatusMessage): Piece[] {
  const plain = tokens["color.text"];
  return [
    { text, fg: colours[kind] },
    ...people.flatMap((person, place) => [
      { text: place === 0 ? " " : ", ", fg: plain },
      markPerson(person),
    ]),
  ];
}

/**
 * docket's own state. The left side is the list's, one message at a
 * time: the cases are listed in priority order, the first that applies
 * is the one shown, and the side stays blank when none does (the
 * prerequisite frames). A message too wide for the pane drops its part
 * that gives way first, a full refresh its pages, and only then is cut
 * with `…`. The right side is the details', dimmed, as
 * `describeDetails` chooses it: `details 3/12` while any asked for are
 * unread, or `details paused` once their hour's budget is spent, hidden
 * while nothing is read, and dropped when the two sides would meet.
 *
 * `import { StatusLine } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.status_line
 */
const StatusLine = ({
  status,
  action,
  attention,
  detailsPaused,
  details,
  now,
  timezone,
  names,
  width,
}: StatusLineProps): ReactNode => {
  const message = describeStatus(
    status,
    now,
    timezone,
    names,
    action,
    attention,
  );
  // A message too wide first drops the part that gives way, and only
  // then is cut.
  const fitted =
    message?.shorter !== undefined && Bun.stringWidth(message.text) > width
      ? { ...message, text: message.shorter }
      : message;
  const runs = fitted ? fitPieces(describeRuns(fitted), width) : [];
  const right = describeDetails(
    status,
    message,
    attention,
    detailsPaused,
    details,
  );
  // At least one cell apart, or the right side is left out.
  const gap = width - measurePieces(runs) - Bun.stringWidth(right);
  return (
    <text>
      {runs.map(({ text, fg }, run) => (
        // A line's runs never reorder, so their place is their key.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above.
        <span key={run} fg={fg}>
          {text}
        </span>
      ))}
      {right && gap > 0 && (
        <span fg={tokens["color.text.muted"]}>
          {`${" ".repeat(gap)}${right}`}
        </span>
      )}
    </text>
  );
};

export default StatusLine;
