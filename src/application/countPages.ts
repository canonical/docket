import type { RepoProgress } from "../lib/cache/index.js";
import type { ProgressLineProps } from "../lib/ui/index.js";

/**
 * The pages read of the repositories a refresh has begun reading, and
 * the pages they have, so the total grows as each begins: a repository
 * waiting, checking for changes, paused or failed adds none.
 */
export default function countPages(
  stages: readonly RepoProgress[],
): Pick<ProgressLineProps, "fetched" | "total"> {
  let fetched = 0;
  let total = 0;
  for (const { stage } of stages) {
    if (!("fetched" in stage)) continue;
    fetched += stage.fetched;
    total += stage.total;
  }
  return { fetched, total };
}
