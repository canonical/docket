import type { RepoProgress } from "../cache/index.js";

/** The first repository a refresh is on, and how far it has read. */
export interface StageUnderWay {
  readonly repo: string;
  /** Its place among the watched repositories, from 1. */
  readonly position: number;
  /** How many repositories are watched. */
  readonly count: number;
  /** The pages it has read, 0 of 0 before the first. */
  readonly fetched: number;
  readonly total: number;
}

/**
 * The first repository in `stages` that a refresh is on, checking for
 * changes, reading its threads or its checks, or none when every one
 * waits, is done, paused or failed.
 */
export default function findStageUnderWay(
  stages: readonly RepoProgress[],
): StageUnderWay | undefined {
  const position = stages.findIndex(({ stage }) =>
    ["checking", "reading", "checks"].includes(stage.kind),
  );
  const found = stages[position];
  if (!found) return undefined;
  const { stage } = found;
  const pages =
    stage.kind === "reading"
      ? { fetched: stage.fetched, total: stage.total }
      : { fetched: 0, total: 0 };
  return {
    repo: found.repo,
    position: position + 1,
    count: stages.length,
    ...pages,
  };
}
