import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { loginCells } from "../../constants.js";
import {
  fitField,
  fitRuns,
  markPerson,
  measurePieces,
  measureText,
} from "../../fit/index.js";
import type { Piece } from "../../types.js";
import { marginCells } from "../Margin/constants.js";
import { Margin } from "../Margin/index.js";
import type { EventLineProps } from "./types.js";

/** The cells an event is indented by: one step deeper than the accordion. */
const indent = 4;

/** The spaces between the margin and the event. */
const gutter = " ".repeat(indent - marginCells);

/** The fewest cells the words before a target keep once they are cut. */
const wordsCells = 4;

/** The cells a target keeps, cut, before the words before it give way. */
const targetCells = 12;

/**
 * What was done, in `room` cells, split about what it acted on: the
 * words before it, the target, and any words after it, the bracket
 * closing failed checks' names. The target stays whole where it can, and
 * is cut, by its kind's rule for an event, down to 12 cells while the
 * words stay whole; past that the words are cut, at their end, down to
 * four cells, and the target takes the rest.
 */
function describeAction(
  { action, target }: EventLineProps["line"],
  room: number,
): string {
  if (!target) return fitField(action, "event", room);
  const at = action.text.lastIndexOf(target.text);
  const words = action.text.slice(0, at).trimEnd();
  const space = action.text.slice(words.length, at);
  const after = action.text.slice(at + target.text.length);
  const tail = measureText(target.text) + measureText(after);
  const targetRoom =
    room - measureText(words) - measureText(space) - measureText(after);
  if (targetRoom >= Math.min(measureText(target.text), targetCells)) {
    return `${words}${space}${fitField(target, "event", targetRoom)}${after}`;
  }
  const wordsRoom = Math.max(
    Math.min(measureText(words), wordsCells),
    room - measureText(space) - tail,
  );
  const before = `${fitField({ text: words, kind: "words" }, "line", wordsRoom)}${space}`;
  const cells = room - measureText(before) - measureText(after);
  return `${before}${fitField(target, "event", cells)}${after}`;
}

/**
 * Who did what, in `room` cells: failed checks after `✗` in the error
 * colour, whoever ran them; otherwise the actor behind their group's
 * mark, its login cut at 12 cells, then what they did, dimmed when a bot
 * did it, since a bot's event is context. The actor always stays, a bot's
 * mark with it; what they did gives way as `describeAction` cuts it.
 */
function describeWhat(line: EventLineProps["line"], room: number): Piece[] {
  const { event, actor } = line;
  if (event.kind === "checksFailed") {
    const failed = `${tokens["glyph.failed"]} `;
    return [
      {
        text: `${failed}${describeAction(line, room - measureText(failed))}`,
        fg: tokens["color.text.error"],
      },
    ];
  }
  const tone = event.bot ? tokens["color.text.muted"] : tokens["color.text"];
  const who = actor ? [markPerson(actor, loginCells)] : [];
  // A space between the actor and what they did.
  const what = describeAction(line, room - measurePieces(who) - who.length);
  return [...who, { text: who.length > 0 ? ` ${what}` : what, fg: tone }];
}

/**
 * One event in activity, nested under its thread: who did what, and how
 * long ago at the right edge. The thread's margin runs beside it: no
 * clock runs in activity, so the bar's column is blank, and the stack
 * mark goes on under a stacked pull request. The line stays one line,
 * and the event gives way before the age does: the actor's login at 12
 * cells, then the words of what was done, then what it acted on. A bot's age is
 * dimmed with its event, failed checks aside; every other age is plain.
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
