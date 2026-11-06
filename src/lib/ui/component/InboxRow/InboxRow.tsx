import type { ReactNode } from "react";
import type { InboxSubjectKind } from "../../../inbox/index.js";
import { tokens } from "../../../tokens/index.js";
import { fitField, fitRuns, measureText } from "../../fit/index.js";
import type { Piece } from "../../types.js";
import { marginCells } from "../Margin/constants.js";
import type { InboxRowProps } from "./types.js";

/** The one-cell mark of each kind of notification subject. */
const marks: Readonly<Record<InboxSubjectKind, string>> = {
  issue: tokens["glyph.thread.issue"],
  pullRequest: tokens["glyph.thread.pullRequest"],
  discussion: tokens["glyph.thread.discussion"],
  commit: tokens["glyph.inbox.other"],
  release: tokens["glyph.inbox.other"],
  security: tokens["glyph.inbox.other"],
  invitation: tokens["glyph.inbox.other"],
  other: tokens["glyph.inbox.other"],
};

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
 * One notification, two lines tall: its kind's mark, reference, reason
 * and age on the bold first line, then its title in italic. The unread
 * mark sits in the margin. A subject docket cannot detail carries
 * `browser only` in the reason's place, and opens in the browser.
 *
 * `import { InboxRow } from "../lib/ui/index.js";`
 */
export default function InboxRow({
  row,
  selected = false,
  width,
}: InboxRowProps): ReactNode {
  const inner = width - marginCells;
  const mark = marks[row.subjectKind];
  const figure = fitField(row.distance, "line", inner);
  const reason = fitField(row.reason, "line", inner);
  const reference = fitField(
    row.reference,
    "line",
    inner - measureText(mark) - measureText(reason) - measureText(figure) - 2,
  );
  const head: Piece[] = [
    { text: `${mark} ${reference} ${reason}`, fg: tokens["color.text"] },
  ];
  const left = measureText(head[0]?.text ?? "");
  head.push({
    text: " ".repeat(Math.max(1, inner - left - measureText(figure))),
    fg: tokens["color.text"],
  });
  head.push({ text: figure, fg: tokens["color.text"] });
  return (
    <box
      flexDirection="row"
      flexShrink={0}
      backgroundColor={
        selected ? tokens["color.background.selected"] : undefined
      }
    >
      <box flexDirection="column" width={marginCells} flexShrink={0}>
        <text fg={tokens["color.text.muted"]}>
          {row.unread ? `${tokens["glyph.inbox.unread"]} ` : "  "}
        </text>
        <text fg={tokens["color.text.muted"]}> </text>
      </box>
      <box flexDirection="column" width={inner}>
        {drawLine(
          head.map((piece) => ({
            ...piece,
            attributes: tokens["typography.weight.bold"],
          })),
          inner,
        )}
        {drawLine(
          [
            {
              text: fitField(row.title, "line", inner),
              fg: tokens["color.text"],
              attributes: tokens["typography.style.italic"],
            },
          ],
          inner,
        )}
      </box>
    </box>
  );
}
