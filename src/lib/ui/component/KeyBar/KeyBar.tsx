import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import trimText from "../../trimText.js";
import type { KeyBarProps } from "./types.js";

/** A run of the bar's text: a key, its label, or the gap between hints. */
interface Piece {
  readonly id: string;
  readonly text: string;
  readonly look: "key" | "label" | "gap";
}

/** Cuts the piece that crosses `width` with `…`, dropping the rest. */
function fit(pieces: readonly Piece[], width: number): Piece[] {
  const fitted: Piece[] = [];
  let room = width;
  for (const piece of pieces) {
    const cells = Bun.stringWidth(piece.text);
    if (cells > room) {
      fitted.push({ ...piece, text: trimText(piece.text, room) });
      break;
    }
    fitted.push(piece);
    room -= cells;
  }
  return fitted;
}

/**
 * The last line of the pane: a reminder of the main keys, fitted to 40
 * columns. Which hints it shows depends on what is open, and `?` is
 * always among them.
 *
 * `import { KeyBar } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.key_bar
 */
const KeyBar = ({ commands, width }: KeyBarProps): ReactNode => {
  const pieces = commands
    .filter(({ hint }) => hint !== undefined)
    .flatMap(({ keys, hint, label }, index): Piece[] => [
      ...(index === 0
        ? []
        : [{ id: `${label} gap`, text: " ", look: "gap" as const }]),
      { id: `${label} key`, text: keys.join(""), look: "key" },
      ...(hint
        ? [{ id: label, text: ` ${hint}`, look: "label" as const }]
        : []),
    ]);
  return (
    <text fg={tokens["color.text"]}>
      {fit(pieces, width).map(({ id, text, look }) => (
        <span
          key={id}
          fg={
            look === "label" ? tokens["color.text.muted"] : tokens["color.text"]
          }
          attributes={
            look === "key" ? tokens["typography.weight.bold"] : undefined
          }
        >
          {text}
        </span>
      ))}
    </text>
  );
};

export default KeyBar;
