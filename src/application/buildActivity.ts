import {
  type ActivityGrouping,
  type ActivityList,
  groupEvents,
  listEvents,
} from "../lib/activity/index.js";
import type { Duration } from "../lib/clock/index.js";
import type { TimedEvent } from "../lib/events/index.js";
import type { Thread } from "../lib/waits/index.js";
import type { Watched } from "./types.js";

/**
 * Builds activity at `now`: the events each watched repository recorded
 * within the window of working time before it, on that repository's
 * working clock, under their threads. The threads give each row its
 * owners. The rows of a repository whose own file is invalid are marked.
 *
 * @param events Each repository's events, timed against the window on its
 * own clock, by its `owner/name`, reaching back far enough for the window;
 * a repository with none given has none. Which are inside the window at
 * `now` is read from their times, so no working time is counted here.
 */
export default function buildActivity(
  events: ReadonlyMap<string, readonly TimedEvent[]>,
  threads: readonly Thread[],
  watched: readonly Watched[],
  window: Duration,
  grouping: ActivityGrouping,
  now: Date,
): ActivityList {
  const repos = watched.map((repo) => {
    const { settings, repositoryErrors } = repo.resolved;
    return {
      repo,
      people: settings.people,
      threads: threads.filter((thread) => thread.repo === repo.repo),
      events: (events.get(repo.repo) ?? [])
        .filter(({ until }) => until >= now)
        .map(({ event }) => event),
      invalidFile: repositoryErrors.length > 0,
    };
  });
  const list = listEvents(repos, now);
  return groupEvents(list, { mode: "activity", window, grouping }, watched);
}
