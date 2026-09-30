import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import fitPieces from "../../fitPieces.js";
import trimText from "../../trimText.js";
import type { Piece } from "../../types.js";
import wrapText from "../../wrapText.js";
import describeStage from "./describeStage.js";
import type { RefreshStagesProps } from "./types.js";

/**
 * The lines of each run a stage takes: a failure's reason wraps under
 * the stage's column, and any other stage is trimmed to one line.
 */
function fitStage(pieces: readonly Piece[], room: number): Piece[][] {
  const [only] = pieces;
  if (pieces.length === 1 && only) {
    return wrapText(only.text, room).map((text) => [{ ...only, text }]);
  }
  return [fitPieces(pieces, room)];
}

/**
 * One line for each watched repository while nothing is shown, as on the
 * first run: its short name, padded to the longest name and one cell
 * more, then its stage (`checking for changes`, `reading page 2/3`,
 * `reading checks`, `✓ 89 threads`, `waiting`, `paused`, `✗ failed: …`).
 *
 * `import { RefreshStages } from "../lib/ui/index.js";`
 */
const RefreshStages = ({
  stages,
  names,
  width,
}: RefreshStagesProps): ReactNode => {
  const shown = stages.map(({ repo, stage }) => ({
    repo,
    name: trimText(names[repo] ?? repo, width),
    stage,
  }));
  const column =
    Math.max(...shown.map(({ name }) => Bun.stringWidth(name))) + 1;
  const room = Math.max(1, width - column);
  return (
    <box flexDirection="column">
      {shown.flatMap(({ repo, name, stage }) =>
        fitStage(describeStage(stage), room).map((runs, place) => (
          // A stage's wrapped lines never reorder, so their place is their key.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <text key={`${repo}:${place}`}>
            <span fg={tokens["color.text"]}>
              {place === 0
                ? `${name}${" ".repeat(column - Bun.stringWidth(name))}`
                : " ".repeat(column)}
            </span>
            {runs.map(({ text, fg }, run) => (
              // A line's runs never reorder, so their place is their key.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above.
              <span key={run} fg={fg}>
                {text}
              </span>
            ))}
          </text>
        )),
      )}
    </box>
  );
};

export default RefreshStages;
