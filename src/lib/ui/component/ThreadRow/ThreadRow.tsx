import type { ReactNode } from "react";
import type { Verdict } from "../../../endings/index.js";
import type { WaitState } from "../../../owed/index.js";
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
import describeTitleLines from "./describeTitleLines.js";
import listOwnerLines from "./listOwnerLines.js";
import type { ThreadRowProps } from "./types.js";

/**
 * The colour of the distance: the error and warning colours when the wait
 * is over its target or due soon, as the bar has, and plain text on track;
 * in finished, the error colour beside `over` past the target, and plain
 * text within it, where the bar alone is green.
 */
const distanceColours: Readonly<Record<WaitState | Verdict, string>> = {
  over: tokens["color.text.error"],
  soon: tokens["color.text.warning"],
  onTrack: tokens["color.text"],
  within: tokens["color.text"],
};

/**
 * What the bar and the distance show: the running wait's state in owed,
 * the verdict in finished, and nothing in activity or on a thread a label
 * exempts.
 */
const readState = (row: ThreadRowProps["row"]) =>
  "state" in row ? row.state : "verdict" in row ? row.verdict : undefined;

/**
 * Below this many cells of login the author leaves the first line: `d…`
 * names nobody, and the accordion names the author whole.
 */
const authorMinCells = 4;

const space = (count: number): Piece => ({
  text: " ".repeat(Math.max(0, count)),
  fg: tokens["color.text"],
});

/**
 * The row's head, all of it bold: the reference and the kinds, then the
 * author, then the distance at the right edge. The kinds and the distance
 * always show whole; the reference too, unless its repository's short
 * name leaves them no room, when it is cut in its middle and keeps its
 * number. The author gives way first, its login cut before its mark, and
 * once fewer than four cells of login would remain it leaves the line.
 */
function describeHead(row: ThreadRowProps["row"], inner: number): Piece[] {
  const text = tokens["color.text"];
  const figure = fitField(row.distance, "line", inner);
  const kinds = ("wait" in row ? [row.threadKind, row.kind] : [row.kind])
    .map((field) => fitField(field, "line", inner))
    .join(" ");
  // A space after the reference, and one before the distance.
  const reference = fitField(
    row.reference,
    "line",
    inner - measureText(kinds) - measureText(figure) - 2,
  );
  const words = `${reference} ${kinds}`;
  // The mark and the space after it take two cells beside the login.
  const room = inner - measureText(words) - measureText(figure) - 4;
  const author =
    row.author && room >= authorMinCells
      ? [space(1), markPerson(row.author, Math.min(loginCells, room))]
      : [];
  const left = [{ text: words, fg: text }, ...author];
  const state = readState(row);
  return [
    ...left,
    space(inner - measurePieces(left) - measureText(figure)),
    { text: figure, fg: state ? distanceColours[state] : text },
  ].map((piece) => ({
    ...piece,
    attributes: tokens["typography.weight.bold"],
  }));
}

/** Draws the runs of one line, fitted to `width`. */
const drawLine = (pieces: readonly Piece[], width: number) => (
  <text>
    {fitRuns(pieces, width).map(({ text, fg, attributes }, index) => (
      // A line's runs never reorder, so their place is their key.
      // biome-ignore lint/suspicious/noArrayIndexKey: see above.
      <span key={index} fg={fg} attributes={attributes}>
        {text}
      </span>
    ))}
  </text>
);

/**
 * One thread in the list, two lines tall. The first line, the row's head and
 * the only bold text on the screen, carries the reference, the kind of thread,
 * the kind of wait, the author and the distance; the second the title in
 * italic, then at the right `draft`, any field in trouble and the owner.
 * Position carries each person's role: the person waiting at the left of the
 * first line, the person who owes at the right of the second, each behind their
 * group's mark. The same row serves every mode: in owed the figure is the
 * distance to target, coloured with the state the bar marks; in activity the
 * kind of wait is left out, the figure is the age of the newest event, in the
 * plain text colour, and the bar's column is blank; in finished the figure is
 * the verdict, `4d over` in the error colour past the target or `open 3d`
 * within it, and the bar gives it in its weight and hue. When two or more
 * people own the thread, a third line lists every one of them, right-aligned,
 * so the row's height says how many own it. The selected row's title wraps in
 * full rather than being trimmed, with the group at its right on the title's
 * last line when it fits there. Selection is the only background, and it covers
 * every line of the selected row.
 *
 * `import { ThreadRow } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.thread_row
 */
const ThreadRow = ({
  row,
  selected = false,
  continued = false,
  width,
}: ThreadRowProps): ReactNode => {
  const inner = width - marginCells;
  const titles = describeTitleLines(row, inner, selected);
  const owners = listOwnerLines(row, width);
  return (
    <box
      flexDirection="row"
      flexShrink={0}
      backgroundColor={
        selected ? tokens["color.background.selected"] : undefined
      }
    >
      <Margin
        state={readState(row)}
        stacked={row.stacked}
        lines={1 + titles.length + owners.length}
        ends={!continued}
      />
      <box flexDirection="column" width={inner}>
        {drawLine(describeHead(row, inner), inner)}
        {titles.map((line, place) => (
          // The title's lines never reorder, so their place is their key.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <box key={place}>{drawLine(line, inner)}</box>
        ))}
        {owners.map((line, place) => (
          // The owners' lines never reorder, so their place is their key.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <box key={place}>
            {drawLine([space(inner - measurePieces(line)), ...line], inner)}
          </box>
        ))}
      </box>
    </box>
  );
};

export default ThreadRow;
