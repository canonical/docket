import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { fitRuns, measureText } from "../../fit/index.js";
import type { KeyCommand } from "../../hooks/index.js";
import type { KeyBarProps } from "./types.js";

/** A run of the bar's text: a key, its label, or the gap between hints. */
interface Piece {
  readonly id: string;
  readonly text: string;
  readonly look: "key" | "label" | "gap";
}

/** The runs of the hints given, a space between each. */
const describeHints = (commands: readonly KeyCommand[]): Piece[] =>
  commands.flatMap(({ keys, hint, label }, index): Piece[] => [
    ...(index === 0
      ? []
      : [{ id: `${label} gap`, text: " ", look: "gap" as const }]),
    { id: `${label} key`, text: keys.join(""), look: "key" },
    ...(hint ? [{ id: label, text: ` ${hint}`, look: "label" as const }] : []),
  ]);

const measure = (pieces: readonly Piece[]) =>
  pieces.reduce((cells, { text }) => cells + measureText(text), 0);

/**
 * The last line of the pane: a reminder of the main keys, fitted to 40
 * columns. Which hints it shows depends on what is open. A hint is never
 * cut: when they do not all fit, the last ones leave the bar whole, in
 * the order given, and `?`, which lists every key, leaves last.
 *
 * `import { KeyBar } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.key_bar
 */
const KeyBar = ({ commands, width }: KeyBarProps): ReactNode => {
  const hinted = commands.filter(({ hint }) => hint !== undefined);
  const shown = [...hinted];
  let pieces = describeHints(shown);
  while (measure(pieces) > width && shown.length > 0) {
    const leaving = shown.findLastIndex(({ keys }) => !keys.includes("?"));
    shown.splice(leaving, 1);
    pieces = describeHints(shown);
  }
  return (
    <text fg={tokens["color.text"]}>
      {fitRuns(pieces, width).map(({ id, text, look }) => (
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
