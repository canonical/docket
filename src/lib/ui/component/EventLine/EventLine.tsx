import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import fitPieces from "../../fitPieces.js";
import markPerson from "../../markPerson.js";
import measurePieces from "../../measurePieces.js";
import type { Piece } from "../../types.js";
import { marginCells } from "../Margin/constants.js";
import { Margin } from "../Margin/index.js";
import type { EventLineProps } from "./types.js";

/** The cells an event is indented by: one step deeper than the accordion. */
const indent = 4;

/** The spaces between the margin and the event. */
const gutter = " ".repeat(indent - marginCells);

/**
 * Whether a bot made the event or ended the thread, whose line is then
 * context, dimmed; failed checks are a line crossed, whoever ran them, so
 * they never are.
 */
const isQuiet = (line: EventLineProps["line"]) =>
  "event" in line
    ? line.event.bot && line.event.kind !== "checksFailed"
    : line.actor?.group === "bot";

/**
 * Who did what: failed checks after `✗` in the error colour, whoever ran
 * them; otherwise the actor behind their group's mark, then what they
 * did, dimmed when a bot did it, since a bot's event is context.
 */
function describeWhat(line: EventLineProps["line"]): Piece[] {
  const { actor, action } = line;
  if ("event" in line && line.event.kind === "checksFailed") {
    return [
      {
        text: `${tokens["glyph.failed"]} ${action.text}`,
        fg: tokens["color.text.error"],
      },
    ];
  }
  const tone = isQuiet(line)
    ? tokens["color.text.muted"]
    : tokens["color.text"];
  return [
    ...(actor ? [markPerson(actor, Number.POSITIVE_INFINITY)] : []),
    { text: actor ? ` ${action.text}` : action.text, fg: tone },
  ];
}

/**
 * One event in activity, nested under its thread, or a finished thread's
 * ending, its one event: who did what, and how long ago at the right
 * edge. The thread's margin runs beside it: no clock runs in activity, so
 * the bar's column is blank, while in finished the verdict's bar runs
 * down to the ending and ends there; the stack mark goes on under a
 * stacked pull request. The line is trimmed, and the
 * event gives way before the age does. A bot's age is dimmed with its
 * event, failed checks aside; every other age is plain.
 *
 * `import { EventLine } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.event_line
 */
const EventLine = ({
  line,
  state,
  stacked,
  width,
}: EventLineProps): ReactNode => {
  const quiet = isQuiet(line);
  const age: Piece = {
    text: line.age.text,
    fg: quiet ? tokens["color.text.muted"] : tokens["color.text"],
  };
  const room = width - indent - Bun.stringWidth(age.text) - 1;
  const what = fitPieces(describeWhat(line), Math.max(0, room));
  const gap = " ".repeat(Math.max(1, room + 1 - measurePieces(what)));
  return (
    <box flexDirection="row" flexShrink={0}>
      <Margin state={state} stacked={stacked} lines={1} ends />
      <text>
        {gutter}
        {[...what, { text: gap, fg: tokens["color.text"] }, age].map(
          ({ text, fg }, run) => (
            // A line's runs never reorder, so their place is their key.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above.
            <span key={run} fg={fg}>
              {text}
            </span>
          ),
        )}
      </text>
    </box>
  );
};

export default EventLine;
