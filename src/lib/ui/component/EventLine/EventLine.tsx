import type { ColorInput } from "@opentui/core";
import type { ReactNode } from "react";
import { sanitize } from "../../../text/index.js";
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

/**
 * Whether a bot made the event or ended the thread, whose line is then
 * context, dimmed; failed checks are a line crossed, whoever ran them, so
 * they never are.
 */
const isQuiet = (line: EventLineProps["line"]) =>
  line.event
    ? line.event.bot && line.event.kind !== "checksFailed"
    : line.actor?.group === "bot";

/**
 * What was done, in `room` cells, split about what it acted on: the
 * words before it, the target, and any words after it, the bracket
 * closing failed checks' names. The words give way first, cut at their
 * end down to four cells, so the target stays whole where it can; past
 * that the target is cut, by its kind's rule for an event, to the rest.
 * The raw text is split first and each part passes `sanitize` on its
 * own, so an escape sequence in the target never swallows the words after
 * it; each is measured as drawn.
 */
function describeAction(
  { action, target }: EventLineProps["line"],
  room: number,
  fg: ColorInput,
): Piece[] {
  if (!target) return [{ text: fitField(action, "event", room), fg }];
  const at = action.text.lastIndexOf(target.text);
  // The space and any bracket before the target go with it.
  const raw = action.text.slice(0, at).replace(/[\s(]+$/, "");
  const words = sanitize(raw);
  const space = sanitize(action.text.slice(raw.length, at));
  const aim = sanitize(target.text);
  const after = sanitize(action.text.slice(at + target.text.length));
  const tail = measureText(aim) + measureText(after);
  const wordsRoom = Math.max(
    Math.min(measureText(words), wordsCells),
    room - measureText(space) - tail,
  );
  const before = `${fitField({ text: words, kind: "words" }, "line", wordsRoom)}${space}`;
  const cells = room - measureText(before) - measureText(after);
  return [
    { text: before, fg },
    { text: fitField({ ...target, text: aim }, "event", cells), fg },
    ...(after ? [{ text: after, fg }] : []),
  ];
}

/**
 * Who did what, in `room` cells: failed checks after `✗` in the error
 * colour, whoever ran them; otherwise the actor behind their group's
 * mark, its login cut at 12 cells, then what they did, dimmed when a bot
 * did it, since a bot's event is context. The actor always stays, a bot's
 * mark with it; what they did gives way as `describeAction` cuts it.
 */
function describeWhat(line: EventLineProps["line"], room: number): Piece[] {
  const { actor } = line;
  if (line.event?.kind === "checksFailed") {
    const failed = `${tokens["glyph.failed"]} `;
    const error = tokens["color.text.error"];
    return [
      { text: failed, fg: error },
      ...describeAction(line, room - measureText(failed), error),
    ];
  }
  const tone = isQuiet(line)
    ? tokens["color.text.muted"]
    : tokens["color.text"];
  const who = actor ? [markPerson(actor, loginCells)] : [];
  // A space between the actor and what they did.
  const what = describeAction(
    line,
    room - measurePieces(who) - who.length,
    tone,
  );
  return [
    ...who,
    ...(who.length > 0 ? [{ text: " ", fg: tone }] : []),
    ...what,
  ];
}

/**
 * One event in activity, nested under its thread, or a finished thread's
 * ending, its one event: who did what, and how long ago at the right
 * edge. The thread's margin runs beside it: no clock runs in activity, so
 * the bar's column is blank, while in finished the verdict's bar runs
 * down to the ending and ends there; the stack mark goes on under a
 * stacked pull request. The line stays one line, and the event gives way
 * before the age does: the actor's login at 12 cells, then the words of
 * what was done, then what it acted on. A bot's age is dimmed with its
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
  const room = width - indent - measureText(age.text) - 1;
  const what = fitRuns(describeWhat(line, room), Math.max(0, room));
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
