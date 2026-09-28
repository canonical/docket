import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import trimText from "../../trimText.js";
import describeStatus from "./describeStatus.js";
import type { StatusLineProps, StatusMessage } from "./types.js";

/**
 * The colour of each kind of message: an error, and an action that
 * failed, take the field-health colour beside their `✗`, an action that
 * went through takes the success colour beside its `✓`, and freshness is
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
 * docket's own state. The left side is the list's, one message at a
 * time: the cases are listed in priority order, the first that applies
 * is the one shown, and the side stays blank when none does (the
 * prerequisite frames). The right side is the details', dimmed:
 * `details paused` while reading them spends nothing, hidden while the
 * left side shows an error or the pane is idle, since nothing is read
 * then, and dropped when the two sides would meet.
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
  const left = message ? trimText(message.text, width) : "";
  const right =
    detailsPaused && message?.kind !== "error" && attention !== "idle"
      ? "details paused"
      : "";
  // At least one cell apart, or the right side is left out.
  const gap = width - Bun.stringWidth(left) - Bun.stringWidth(right);
  return (
    <text fg={message ? colours[message.kind] : tokens["color.text"]}>
      {left}
      {right && gap > 0 && (
        <span fg={tokens["color.text.muted"]}>
          {`${" ".repeat(gap)}${right}`}
        </span>
      )}
    </text>
  );
};

export default StatusLine;
