import type { ReactNode } from "react";
import type { CacheStatus, RepoStage } from "../lib/cache/index.js";
import type { Repo } from "../lib/config/index.js";
import { tokens } from "../lib/tokens/index.js";
import {
  countPages,
  ProgressLine,
  RefreshStages,
  wrapNotice,
} from "../lib/ui/index.js";
import { standInIndent } from "./constants.js";

/** What the first run's lines are drawn from. */
export interface FirstRunProps {
  readonly status: CacheStatus | undefined;
  readonly watched: readonly Pick<Repo, "repo" | "name">[];
  /** The width of the pane, in display cells. */
  readonly width: number;
}

/**
 * What stands in for the list while nothing is shown, as on the first
 * run: `refresh in progress…`, then a line for each repository with its
 * stage, the step that recovers from the failure a repository stopped on
 * under them, and the progress line, counting the pages of the
 * repositories begun, once a first page says how many there are.
 */
export default function drawFirstRun({
  status,
  watched,
  width,
}: FirstRunProps): ReactNode {
  const room = width - standInIndent;
  const stages = status?.stages ?? [];
  const pages = countPages(stages);
  const failed = stages
    .map(({ stage }) => stage)
    .find(
      (stage): stage is Extract<RepoStage, { kind: "failed" }> =>
        stage.kind === "failed",
    );
  return (
    <box flexDirection="column" paddingLeft={standInIndent}>
      <text fg={tokens["color.text"]}>refresh in progress…</text>
      {stages.length > 0 && (
        <RefreshStages
          stages={stages}
          names={Object.fromEntries(
            watched.map(({ repo, name }) => [repo, name]),
          )}
          width={room}
        />
      )}
      {failed && (
        <text fg={tokens["color.text"]}>
          {wrapNotice("", failed.error.recovery, room).recovery.join("\n")}
        </text>
      )}
      {pages.total > 0 && <ProgressLine {...pages} width={room} />}
    </box>
  );
}
