import type { ReactNode } from "react";
import type { EventLine as Line } from "../../../activity/index.js";
import { tokens } from "../../../tokens/index.js";
import trimText from "../../trimText.js";
import { marginCells } from "../Margin/constants.js";
import { Margin } from "../Margin/index.js";
import type { EventLineProps } from "./types.js";

/** The cells an event is indented by: one step deeper than the accordion. */
const indent = 4;

/** The spaces between the margin and the event. */
const gutter = " ".repeat(indent - marginCells);

/**
 * The colour of the whole line, age included: failed checks are a field
 * in trouble, so they take the error colour whoever ran them; a bot's
 * event is context, so it is dimmed; any other reads as plain text.
 */
function chooseColour({ event }: Line): string {
  if (event.kind === "checksFailed") return tokens["color.text.error"];
  return event.bot ? tokens["color.text.muted"] : tokens["color.text"];
}

/**
 * One event in activity, nested under its thread: who did what, and how
 * long ago at the right edge. The thread's margin runs beside it: no
 * clock runs in activity, so the bar's column is blank, and the stack
 * mark goes on under a stacked pull request. The line is trimmed, and the text gives way
 * before the age does. Failed checks start with `✗`, so the error colour
 * is never the only sign.
 *
 * `import { EventLine } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.event_line
 */
const EventLine = ({ line, stacked, width }: EventLineProps): ReactNode => {
  const age = line.age.text;
  const symbol = line.event.kind === "checksFailed" ? "✗ " : "";
  const room = width - indent - Bun.stringWidth(age) - 1;
  const text = trimText(`${symbol}${line.text.text}`, Math.max(0, room));
  const gap = " ".repeat(Math.max(1, room + 1 - Bun.stringWidth(text)));
  return (
    <box flexDirection="row" flexShrink={0}>
      <Margin stacked={stacked} lines={1} ends />
      <text fg={chooseColour(line)}>{`${gutter}${text}${gap}${age}`}</text>
    </box>
  );
};

export default EventLine;
