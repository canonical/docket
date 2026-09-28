import type { ReactNode } from "react";
import type { ThreadRow } from "../../../activity/index.js";
import { tokens } from "../../../tokens/index.js";
import fitPieces from "../../fitPieces.js";
import trimText from "../../trimText.js";
import wrapText from "../../wrapText.js";
import type { ActivityRowProps } from "./types.js";

/**
 * The cells the margin takes. activity measures no wait, so the first,
 * the state marker's in owed, stays blank; the second holds the stack
 * rule.
 */
const margin = 2;

/**
 * The most cells a login takes on a row, so the title keeps its room. A
 * longer login is cut with `…`.
 */
const loginCells = 12;

/** A run of a line's text, in its own colour. */
interface Piece {
  readonly text: string;
  readonly fg: string;
}

/**
 * The runs after the title on the second line: the owner, `draft`
 * dimmed, then an invalid repository file in the error colour, after
 * `✗` so the colour is never the only sign.
 */
function listMarks(row: ThreadRow): Piece[] {
  return [
    ...(row.owner
      ? [
          {
            text: ` · ${trimText(row.owner.text, loginCells)}`,
            fg: tokens["color.text"],
          },
        ]
      : []),
    ...(row.draft
      ? [{ text: ` ${row.draft.text}`, fg: tokens["color.text.muted"] }]
      : []),
    ...(row.invalidFile
      ? [{ text: ` ✗ ${row.invalidFile.text}`, fg: tokens["color.text.error"] }]
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
 * One thread in activity, two lines tall, over its events. The first line
 * carries the margin, the reference, the kind of thread and the age of
 * its newest event; the second the title, the owner and any mark. When
 * two or more people own the thread, a third line lists every one of
 * them. The margin's stack rule, dimmed, runs down every line of a pull
 * request in a stack.
 *
 * `import { ActivityRow } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.thread_row
 */
const ActivityRow = ({ row, width }: ActivityRowProps): ReactNode => {
  const inner = width - margin;
  const text = tokens["color.text"];
  const age = row.distance.text;
  const head = trimText(
    `${row.reference.text} ${row.kind.text}`,
    inner - Bun.stringWidth(age) - 1,
  );
  const gap = " ".repeat(
    Math.max(1, inner - Bun.stringWidth(head) - Bun.stringWidth(age)),
  );
  const marks = listMarks(row);
  const markCells = marks.reduce(
    (cells, mark) => cells + Bun.stringWidth(mark.text),
    0,
  );
  // The title gives way first, so the owner and the marks fit.
  const title = trimText(row.title.text, Math.max(0, inner - markCells));
  const owners = row.owners
    ? wrapText(
        row.owners.fields
          .map((owner) => trimText(owner.text, loginCells))
          .join(", "),
        inner,
      )
    : [];
  const lines = 2 + owners.length;
  return (
    <box flexDirection="row" flexShrink={0}>
      <box flexDirection="column" width={margin}>
        {Array.from({ length: lines }, (_, line) => (
          // The margin's lines are all alike, so their place is their key.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <text key={line} fg={tokens["color.text.muted"]}>
            {row.stacked ? " ┃" : "  "}
          </text>
        ))}
      </box>
      <box flexDirection="column" width={inner}>
        {drawLine(
          [
            { text: head, fg: text },
            { text: gap, fg: text },
            { text: age, fg: text },
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

export default ActivityRow;
