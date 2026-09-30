import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { loginCells } from "../../constants.js";
import { fitField, fitRuns, markPerson, measureText } from "../../fit/index.js";
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
 * Who did what, in `room` cells: failed checks after `✗` in the error
 * colour, whoever ran them; otherwise the actor behind their group's
 * mark, their login cut at 12 cells, then what they did, dimmed when a
 * bot did it, since a bot's event is context. What they did is cut in its
 * middle, so what it acted on, a label or a person, stays at its end.
 */
function describeWhat(
  { event, actor, action }: EventLineProps["line"],
  room: number,
): Piece[] {
  if (event.kind === "checksFailed") {
    const failed = `${tokens["glyph.failed"]} `;
    return [
      {
        text: `${failed}${fitField(action, "event", room - measureText(failed))}`,
        fg: tokens["color.text.error"],
      },
    ];
  }
  const tone = event.bot ? tokens["color.text.muted"] : tokens["color.text"];
  const who = actor ? [markPerson(actor, loginCells)] : [];
  // A space between the actor and what they did.
  const left = room - measurePieces(who) - who.length;
  const what = fitField(action, "event", left);
  return [...who, { text: actor ? ` ${what}` : what, fg: tone }];
}

/**
 * One event in activity, nested under its thread: who did what, and how
 * long ago at the right edge. The thread's margin runs beside it: no
 * clock runs in activity, so the bar's column is blank, and the stack
 * mark goes on under a stacked pull request. The line stays one line,
 * and the event gives way before the age does: the actor's login first,
 * cut at 12 cells, then what they did, from its middle. A bot's age is dimmed with its
 * event, failed checks aside; every other age is plain.
 *
 * `import { EventLine } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.event_line
 */
const EventLine = ({ line, stacked, width }: EventLineProps): ReactNode => {
  // Failed checks are a line crossed, whoever ran them, so only a bot's
  // other events are dimmed as context.
  const quiet = line.event.bot && line.event.kind !== "checksFailed";
  const age: Piece = {
    text: line.age.text,
    fg: quiet ? tokens["color.text.muted"] : tokens["color.text"],
  };
  const room = width - indent - measureText(age.text) - 1;
  const what = fitRuns(describeWhat(line, room), Math.max(0, room));
  const gap = " ".repeat(Math.max(1, room + 1 - measurePieces(what)));
  return (
    <box flexDirection="row" flexShrink={0}>
      <Margin stacked={stacked} lines={1} ends />
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
