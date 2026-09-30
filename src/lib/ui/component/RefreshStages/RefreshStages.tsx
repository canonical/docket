import type { ReactNode } from "react";
import type { RepoStage } from "../../../cache/index.js";
import { tokens } from "../../../tokens/index.js";
import { fitField, fitPieces } from "../../fit/index.js";
import type { Piece } from "../../types.js";
import describeStage from "./describeStage.js";
import type { RefreshStagesProps } from "./types.js";

/**
 * The lines of each run a stage takes: a failure's reason wraps under
 * the stage's column, and any other stage is trimmed to one line.
 */
function fitStage(stage: RepoStage, room: number): Piece[][] {
  const pieces = describeStage(stage);
  if (stage.kind !== "failed") return [fitPieces(pieces, room)];
  return pieces.flatMap((piece) =>
    fitField({ text: piece.text, kind: "reason" }, "block", room).map(
      (text) => [{ ...piece, text }],
    ),
  );
}

/**
 * The cells the stage's column keeps whatever the names beside it:
 * `checking for changes`, the widest stage on one line.
 */
const stageCells = 20;

/**
 * One line for each watched repository while nothing is shown, as on the
 * first run: its short name, padded to the longest name and one cell
 * more, a name that would leave the stage fewer than 20 cells cut in its
 * middle, then its stage (`checking for changes`, `reading page 2/3`,
 * `reading checks`, `✓ 89 threads`, `waiting`, `paused: budget low`,
 * `paused: rate limit`, `✗ failed: …`).
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
    name: fitField(
      { text: names[repo] ?? repo, kind: "identifier" },
      "line",
      width - stageCells - 1,
    ),
    stage,
  }));
  const column =
    Math.max(...shown.map(({ name }) => Bun.stringWidth(name))) + 1;
  const room = Math.max(1, width - column);
  return (
    <box flexDirection="column">
      {shown.flatMap(({ repo, name, stage }) =>
        fitStage(stage, room).map((runs, place) => (
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
