import {
  gatherPeople,
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
 * `now`. Each login takes one group in its repository, from the settings
 * and the repository's threads. The rows of a repository whose own file
 * is invalid are marked.
 *
 * @param viewer The login gh is signed in with, when it is known, which
 * marks the viewer among the people the rows name.
 */
export default function buildOwed(
  threads: readonly Thread[],
  watched: readonly Watched[],
  grouping: OwedGrouping,
  now: Date,
  viewer?: string,
): OwedList {
  const list = listWaits(
    watched.map((repo) => {
      const { settings, repositoryErrors } = repo.resolved;
      const own = threads.filter((thread) => thread.repo === repo.repo);
      return {
        repo,
        time: settings.time,
        people: gatherPeople(own, settings.people),
        yours: settings.you.teams,
        waits: own.flatMap((thread) => findWaits(thread, settings)),
        invalidFile: repositoryErrors.length > 0,
      };
    }),
    now,
    viewer,
  );
  return groupWaits(list, { mode: "owed", grouping }, watched);
}
