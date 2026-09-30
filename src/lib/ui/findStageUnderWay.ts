import type { RepoProgress } from "../cache/index.js";

/** The furthest repository a refresh has reached, and its place. */
interface StageUnderWay {
  readonly repo: string;
  /** Its place among the watched repositories, from 1. */
  readonly position: number;
  /** How many repositories are watched. */
  readonly count: number;
}

/**
 * The furthest repository in `stages` that a refresh has reached, while
 * one is under way, checking for changes, reading its threads or its
 * checks; none when every one waits, is done, paused or failed. The
 * repositories are fetched in turn, so while one is checked or read it
 * is the furthest; while the checks are read, after every repository,
 * the last reached keeps its place, and the figure never
 * goes back.
 */
export default function findStageUnderWay(
  stages: readonly RepoProgress[],
): StageUnderWay | undefined {
  const kinds = stages.map(({ stage }) => stage.kind);
  const position = kinds.findLastIndex((kind) => kind !== "waiting");
  const found = stages[position];
  const going = kinds.some((kind) =>
    ["checking", "reading", "checks"].includes(kind),
  );
  if (!found || !going) return undefined;
  return { repo: found.repo, position: position + 1, count: stages.length };
}
