import type { Duration } from "../lib/clock/index.js";
import type { TimedEnding } from "../lib/endings/index.js";
import {
  type FinishedGrouping,
  type FinishedList,
  groupEndings,
  listEndings,
} from "../lib/finished/index.js";
import { gatherPeople } from "../lib/owed/index.js";
import type { Thread } from "../lib/waits/index.js";
import type { Watched } from "./types.js";

/**
 * Builds finished at `now`: the threads each watched repository saw
 * merged or closed within the window of working time before it, on that
 * repository's working clock, measured against its settings. Each login
 * has one group in its repository, from the settings and from what it
 * wrote on the open threads and the finished ones. The rows of a repository whose own file
 * is invalid are marked.
 *
 * @param endings Each repository's finished threads, timed against the
 * window on its own clock, by its `owner/name`; a repository with none
 * given has none.
 * @param viewer The login gh is signed in with, when it is known, which
 * marks the viewer among the people each row names.
 */
export default function buildFinished(
  endings: ReadonlyMap<string, readonly TimedEnding[]>,
  threads: readonly Thread[],
  watched: readonly Watched[],
  window: Duration,
  grouping: FinishedGrouping,
  now: Date,
  viewer?: string,
): FinishedList {
  const repos = watched.map((repo) => {
    const { settings, repositoryErrors } = repo.resolved;
    const own = threads.filter((thread) => thread.repo === repo.repo);
    const finished = (endings.get(repo.repo) ?? [])
      .filter(({ until }) => until >= now)
      .map(({ thread }) => thread);
    return {
      repo,
      people: gatherPeople(
        own,
        settings.people,
        finished.map(({ author }) => author),
      ),
      settings,
      finished,
      invalidFile: repositoryErrors.length > 0,
    };
  });
  const list = listEndings(repos, now, viewer);
  return groupEndings(list, { mode: "finished", window, grouping }, watched);
}
