import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import fitPieces from "../../fitPieces.js";
import markPerson from "../../markPerson.js";
import measurePieces from "../../measurePieces.js";
import type { Piece } from "../../types.js";
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
      markPerson(person, Number.POSITIVE_INFINITY),
    ]),
  ];
}

/**
 * docket's own state. The left side is the list's, one message at a
 * time: the cases are listed in priority order, the first that applies
 * is the one shown, and the side stays blank when none does (the
 * prerequisite frames). The right side is the details', dimmed:
 * `details paused` once their hour's budget is spent, hidden while the
 * left side shows an error or the rate limit pauses the refresh, or the
 * pane is idle, since nothing is read then, and dropped when the two
 * sides would meet.
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
  const runs = message ? fitPieces(describeRuns(message), width) : [];
  const right =
    detailsPaused &&
    message?.kind !== "error" &&
    status?.paused?.reason !== "rateLimit" &&
    attention !== "idle"
      ? "details paused"
      : "";
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
