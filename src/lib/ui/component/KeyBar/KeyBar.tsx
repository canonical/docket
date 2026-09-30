import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { fitPieces } from "../../fit/index.js";
import type { KeyBarProps } from "./types.js";

/** A run of the bar's text: a key, its label, or the gap between hints. */
interface Piece {
  readonly id: string;
  readonly text: string;
  readonly look: "key" | "label" | "gap";
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
      {fitPieces(pieces, width).map(({ id, text, look }) => (
        <span
          key={id}
          fg={
            look === "label" ? tokens["color.text.muted"] : tokens["color.text"]
          }
        >
          {text}
        </span>
      ))}
    </text>
  );
};

export default KeyBar;
