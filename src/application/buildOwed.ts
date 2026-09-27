import {
  groupWaits,
  listWaits,
  type OwedGrouping,
  type OwedList,
} from "../lib/owed/index.js";
import { findWaits, type Thread } from "../lib/waits/index.js";
import type { Watched } from "./types.js";

/**
 * Builds owed from the cached threads: every running wait of each watched
 * repository, on the settings in effect for that repository, measured at
 * `now`. The rows of a repository whose own file is invalid are marked.
 */
export default function buildOwed(
  threads: readonly Thread[],
  watched: readonly Watched[],
  grouping: OwedGrouping,
  now: Date,
): OwedList {
  const list = listWaits(
    watched.map((repo) => {
      const { settings, repositoryErrors } = repo.resolved;
      return {
        repo,
        time: settings.time,
        waits: threads
          .filter((thread) => thread.repo === repo.repo)
          .flatMap((thread) => findWaits(thread, settings)),
        invalidFile: repositoryErrors.length > 0,
      };
    }),
    now,
  );
  return groupWaits(list, { mode: "owed", grouping }, watched);
}
