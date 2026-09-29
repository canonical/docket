import type { ReactNode } from "react";
import type { WaitState } from "../../../owed/index.js";
import { tokens } from "../../../tokens/index.js";
import { loginCells } from "../../constants.js";
import fitPieces from "../../fitPieces.js";
import markPerson from "../../markPerson.js";
import trimText from "../../trimText.js";
import type { Piece } from "../../types.js";
import { marginCells } from "../Margin/constants.js";
import { Margin } from "../Margin/index.js";
import listOwnerLines from "./listOwnerLines.js";
import type { ThreadRowProps } from "./types.js";

/**
 * The colour of the distance: the error and warning colours when the wait
 * is over its target or due soon, as the bar has, and plain text on track.
 */
const distanceColours: Readonly<Record<WaitState, string>> = {
  over: tokens["color.text.error"],
  soon: tokens["color.text.warning"],
  onTrack: tokens["color.text"],
};

/**
 * Below this many cells of login the author leaves the first line: `d…`
 * names nobody, and the accordion names the author whole.
 */
const authorMinCells = 4;

/** The cells between the title and the group at its right, and inside the group. */
const gutter = "  ";

const cells = (pieces: readonly Piece[]) =>
  pieces.reduce((sum, { text }) => sum + Bun.stringWidth(text), 0);

const space = (count: number): Piece => ({
  text: " ".repeat(Math.max(0, count)),
  fg: tokens["color.text"],
});

/**
 * The row's head, all of it bold: the reference and the kinds, then the
 * author, then the distance at the right edge. The reference, the kinds
 * and the distance always show whole at the pane's width; the author is
 * the one field that gives way, its login cut first and its mark never,
 * and once fewer than four cells of login would remain it leaves the line.
 */
function describeHead(row: ThreadRowProps["row"], inner: number): Piece[] {
  const text = tokens["color.text"];
  const figure = row.distance.text;
  const kinds =
    "wait" in row ? [row.threadKind.text, row.kind.text] : [row.kind.text];
  const words = trimText(
    [row.reference.text, ...kinds].join(" "),
    inner - Bun.stringWidth(figure) - 1,
  );
  // The mark and the space after it take two cells beside the login.
  const room = inner - Bun.stringWidth(words) - Bun.stringWidth(figure) - 4;
  const author =
    row.author && room >= authorMinCells
      ? [space(1), markPerson(row.author, Math.min(loginCells, room))]
      : [];
  const left = [{ text: words, fg: text }, ...author];
  const state = "state" in row ? row.state : undefined;
  return [
    ...left,
    space(inner - cells(left) - Bun.stringWidth(figure)),
    { text: figure, fg: state ? distanceColours[state] : text },
  ].map((piece) => ({
    ...piece,
    attributes: tokens["typography.weight.bold"],
  }));
}

/**
 * The group at the right of the second line: `draft` dimmed, then each
 * field in trouble in the error colour after `✗`, so the colour is never
 * the only sign, then the owner with their mark. Failing checks are a
 * field in trouble of a running wait; activity tells of them as an event.
 * With two or more owners the owner is left out: they take a line of
 * their own.
 */
function listRight(row: ThreadRowProps["row"]): Piece[] {
  const error = tokens["color.text.error"];
  const failed = tokens["glyph.failed"];
  const parts: Piece[] = [
    ...(row.draft
      ? [{ text: row.draft.text, fg: tokens["color.text.muted"] }]
      : []),
    ...("wait" in row && row.wait.thread.checks === "failing"
      ? [{ text: `${failed} checks`, fg: error }]
      : []),
    ...(row.invalidFile
      ? [{ text: `${failed} ${row.invalidFile.text}`, fg: error }]
      : []),
    ...(row.owner ? [markPerson(row.owner, loginCells)] : []),
  ];
  return parts.flatMap((part, place) =>
    place === 0 ? [part] : [space(gutter.length), part],
  );
}

/**
 * The second line: the title in italic at the left, trimmed so the group
 * at the right always fits, since the title gives way first.
 */
function describeTitleLine(row: ThreadRowProps["row"], inner: number): Piece[] {
  const right = listRight(row);
  const room = right.length > 0 ? inner - cells(right) - gutter.length : inner;
  const title: Piece = {
    text: trimText(row.title.text, Math.max(0, room)),
    fg: tokens["color.text"],
    attributes: tokens["typography.style.italic"],
  };
  if (right.length === 0) return [title];
  const gap = Math.max(gutter.length, inner - cells([title, ...right]));
  return [title, space(gap), ...right];
}

/** Draws the runs of one line, fitted to `width`. */
const drawLine = (pieces: readonly Piece[], width: number) => (
  <text>
    {fitPieces(pieces, width).map(({ text, fg, attributes }, index) => (
      // A line's runs never reorder, so their place is their key.
      // biome-ignore lint/suspicious/noArrayIndexKey: see above.
      <span key={index} fg={fg} attributes={attributes}>
        {text}
      </span>
    ))}
  </text>
);

/**
 * One thread in the list, two lines tall. The first line, the row's head
 * and the only bold text on the screen, carries the reference, the kind
 * of thread, the kind of wait, the author and the distance; the second
 * the title in italic, then at the right `draft`, any field in trouble
 * and the owner. Position carries each person's role: the person waiting
 * at the left of the first line, the person who owes at the right of the
 * second, each behind their group's mark. The same row serves both modes:
 * in owed the figure is the distance to target, coloured with the state
 * the bar marks; in activity the kind of wait is left out, the figure is
 * the age of the newest event, in the plain text colour, and the bar's
 * column is blank. When two or more people own the thread, a third line
 * lists every one of them, right-aligned, so the row's height says how
 * many own it. Selection is the only background, and it covers every
 * line of the selected row.
 *
 * `import { ThreadRow } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.thread_row
 */
const ThreadRow = ({
  row,
  selected,
  continued = false,
  width,
}: ThreadRowProps): ReactNode => {
  const inner = width - marginCells;
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
        state={"state" in row ? row.state : undefined}
        stacked={row.stacked}
        lines={2 + owners.length}
        ends={!continued}
      />
      <box flexDirection="column" width={inner}>
        {drawLine(describeHead(row, inner), inner)}
        {drawLine(describeTitleLine(row, inner), inner)}
        {owners.map((line, place) => (
          // The owners' lines never reorder, so their place is their key.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <box key={place}>
            {drawLine([space(inner - cells(line)), ...line], inner)}
          </box>
        ))}
      </box>
    </box>
  );
};

export default ThreadRow;
