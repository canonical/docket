import type { ReactNode } from "react";
import type { WaitRow, WaitState } from "../../../owed/index.js";
import { tokens } from "../../../tokens/index.js";
import fitPieces from "../../fitPieces.js";
import trimText from "../../trimText.js";
import wrapText from "../../wrapText.js";
import { Margin } from "./common/index.js";
import type { ThreadRowProps } from "./types.js";

/** The cells the margin takes: the state marker and the stack rule. */
const margin = 2;

/**
 * The most cells a login takes on a row, so the title keeps its room. A
 * longer login is cut with `…`; the accordion shows it whole.
 */
const loginCells = 12;

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
 * symbol so the colour is never the only sign.
 */
function listMarks(row: WaitRow): Piece[] {
  const text = tokens["color.text"];
  const error = tokens["color.text.error"];
  return [
    ...(row.owner
      ? [{ text: ` · ${trimText(row.owner.text, loginCells)}`, fg: text }]
      : []),
    ...(row.draft
      ? [{ text: ` ${row.draft.text}`, fg: tokens["color.text.muted"] }]
      : []),
    ...(row.wait.thread.checks === "failing"
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
 * the owner and any field in trouble. When two or more people own the
 * wait, a third line lists every one of them, so the row's height says
 * how many own it. Selection is the only background, and it covers every
 * line of the selected row.
 *
 * `import { ThreadRow } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.thread_row
 */
const ThreadRow = ({ row, selected, width }: ThreadRowProps): ReactNode => {
  const inner = width - margin;
  const text = tokens["color.text"];
  const distance = row.distance.text;
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
  const owners = row.owners
    ? wrapText(
        row.owners.fields
          .map((owner) => trimText(owner.text, loginCells))
          .join(", "),
        inner,
      )
    : [];
  return (
    <box
      flexDirection="row"
      flexShrink={0}
      backgroundColor={
        selected ? tokens["color.background.selected"] : undefined
      }
    >
      <Margin
        state={row.state}
        stacked={row.stacked}
        lines={2 + owners.length}
      />
      <box flexDirection="column" width={inner}>
        {drawLine(
          [
            { text: head, fg: text },
            { text: gap, fg: text },
            { text: distance, fg: distanceColours[row.state] },
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
