import type { RepoProgress } from "./types.js";

/**
 * Each repository's stage without the pages it read: what a refresh
 * shows of the stages while rows are on screen, where no page is drawn.
 */
export default function dropPages(
  stages: readonly RepoProgress[],
): readonly unknown[] {
  return stages.map(({ repo, stage }) => {
    if (!("fetched" in stage)) return { repo, stage };
    const { fetched: _fetched, total: _total, ...kind } = stage;
    return { repo, stage: kind };
  });
}
