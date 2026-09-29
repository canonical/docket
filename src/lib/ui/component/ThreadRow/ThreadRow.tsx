import type { ReactNode } from "react";
import type { WaitState } from "../../../owed/index.js";
import { tokens } from "../../../tokens/index.js";
import { loginCells } from "../../constants.js";
import fitPieces from "../../fitPieces.js";
import trimText from "../../trimText.js";
import { marginCells } from "../Margin/constants.js";
import { Margin } from "../Margin/index.js";
import listOwnerLines from "./listOwnerLines.js";
import type { ThreadRowProps } from "./types.js";

/** A run of a line's text, in its own colour. */
interface Piece {
  readonly text: string;
  readonly fg: string;
}

/**
 * The colour of the distance: the field-health colours when the wait is
 * over its target or due soon, and plain text on track.
 */
const distanceColours: Readonly<Record<WaitState, string>> = {
  over: tokens["color.text.error"],
  soon: tokens["color.text.warning"],
  onTrack: tokens["color.text"],
};

/**
 * The runs after the title on the second line: the owner, `draft`
 * dimmed, then each field in trouble in the error colour, each after its
 * symbol so the colour is never the only sign. Failing checks are a
 * field in trouble of a running wait; activity tells of them as an event.
 */
function listMarks(row: ThreadRowProps["row"]): Piece[] {
  const text = tokens["color.text"];
  const error = tokens["color.text.error"];
  return [
    ...(row.owner
      ? [{ text: ` · ${trimText(row.owner.text, loginCells)}`, fg: text }]
      : []),
    ...(row.draft
      ? [{ text: ` ${row.draft.text}`, fg: tokens["color.text.muted"] }]
      : []),
    ...("wait" in row && row.wait.thread.checks === "failing"
      ? [{ text: " ✗ checks", fg: error }]
      : []),
    ...(row.invalidFile
      ? [{ text: ` ✗ ${row.invalidFile.text}`, fg: error }]
      : []),
  ];
}

/** Draws the runs of one line, fitted to `width`. */
const drawLine = (pieces: readonly Piece[], width: number) => (
  <text>
    {fitPieces(pieces, width).map(({ text, fg }, index) => (
      // A line's runs never reorder, so their place is their key.
      // biome-ignore lint/suspicious/noArrayIndexKey: see above.
      <span key={index} fg={fg}>
        {text}
      </span>
    ))}
  </text>
);

/**
 * One thread in the list, two lines tall. The first line carries the
 * margin, the reference, the kind and the distance; the second the title,
 * the owner and any field in trouble. The same row serves both modes: in
 * owed the kind is the kind of wait and the figure is the distance to
 * target, coloured with the state the margin marks; in activity the kind
 * is the kind of thread and the figure is the age of the newest event, in
 * the plain text colour, and the state bar is blank. When two or more
 * people own the thread, a third line lists every one of them, so the
 * row's height says how many own it. Selection is the only background,
 * and it covers every line of the selected row.
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
  const text = tokens["color.text"];
  const distance = row.distance.text;
  const state = "state" in row ? row.state : undefined;
  const head = trimText(
    `${row.reference.text} ${row.kind.text}`,
    inner - Bun.stringWidth(distance) - 1,
  );
  const gap = " ".repeat(
    Math.max(1, inner - Bun.stringWidth(head) - Bun.stringWidth(distance)),
  );
  const marks = listMarks(row);
  const markCells = marks.reduce(
    (cells, { text: mark }) => cells + Bun.stringWidth(mark),
    0,
  );
  // The title gives way first, so the owner and any field in trouble fit.
  const title = trimText(row.title.text, Math.max(0, inner - markCells));
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
        state={state}
        stacked={row.stacked}
        lines={2 + owners.length}
        ends={!continued}
      />
      <box flexDirection="column" width={inner}>
        {drawLine(
          [
            { text: head, fg: text },
            { text: gap, fg: text },
            { text: distance, fg: state ? distanceColours[state] : text },
          ],
          inner,
        )}
        {drawLine([{ text: title, fg: text }, ...marks], inner)}
        {owners.map((line) => (
          <text key={line} fg={text}>
            {line}
          </text>
        ))}
      </box>
    </box>
  );
};

export default ThreadRow;
