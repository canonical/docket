import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import trimText from "../../trimText.js";
import describeStatus from "./describeStatus.js";
import type { StatusLineProps, StatusMessage } from "./types.js";

/**
 * The colour of each kind of message: an error takes the field-health
 * colour beside its `✗`, and freshness is context, so it is dimmed.
 */
const colours: Readonly<Record<StatusMessage["kind"], string>> = {
  error: tokens["color.text.error"],
  progress: tokens["color.text"],
  refreshing: tokens["color.text"],
  notice: tokens["color.text"],
  freshness: tokens["color.text.muted"],
};

/**
 * docket's own state, one message at a time. The cases are listed in
 * priority order: the first that applies is the one shown, and the line
 * stays blank when none does (the prerequisite frames).
 *
 * `import { StatusLine } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.status_line
 */
const StatusLine = ({
  status,
  now,
  timezone,
  names,
  width,
}: StatusLineProps): ReactNode => {
  const message = status && describeStatus(status, now, timezone, names);
  return (
    <text fg={message ? colours[message.kind] : tokens["color.text"]}>
      {message ? trimText(message.text, width) : ""}
    </text>
  );
};

export default StatusLine;
