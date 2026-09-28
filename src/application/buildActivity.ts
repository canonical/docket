import {
  type ActivityGrouping,
  type ActivityList,
  groupEvents,
  listEvents,
} from "../lib/activity/index.js";
import { type Duration, measureDuration } from "../lib/clock/index.js";
import type { Settings } from "../lib/config/index.js";
import { selectEvents, type ThreadEvent } from "../lib/events/index.js";
import type { Thread } from "../lib/waits/index.js";
import type { Watched } from "./types.js";

const day = 86_400_000;

/**
 * How far back to ask for events so that none inside a window of working
 * time is missed. Every seven days hold each workday once, so `n` weeks
 * hold `n` working weeks; a day more covers a clock change.
 */
function findEarliest(window: Duration, settings: Settings, now: Date): Date {
  const workingWeek = settings.time.workdays.length * day;
  const weeks = Math.ceil(measureDuration(window, settings.time) / workingWeek);
  return new Date(now.getTime() - weeks * 7 * day - day);
}

/**
 * Builds activity: the events GitHub records on each watched repository
 * within the window of working time before `now`, on that repository's
 * working clock, under their threads. The threads give each row its
 * owners. The rows of a repository whose own file is invalid are marked.
 *
 * @param readEvents Gives the events of a repository at or after a time.
 * @note Impure: reads the events of each watched repository through
 * `readEvents`.
 */
export default async function buildActivity(
  readEvents: (repo: string, since: Date) => Promise<readonly ThreadEvent[]>,
  threads: readonly Thread[],
  watched: readonly Watched[],
  window: Duration,
  grouping: ActivityGrouping,
  now: Date,
): Promise<ActivityList> {
  const repos = [];
  for (const repo of watched) {
    const { settings, repositoryErrors } = repo.resolved;
    const since = findEarliest(window, settings, now);
    const events = await readEvents(repo.repo, since);
    repos.push({
      repo,
      people: settings.people,
      threads: threads.filter((thread) => thread.repo === repo.repo),
      events: selectEvents(events, window, now, settings),
      invalidFile: repositoryErrors.length > 0,
    });
  }
  const list = listEvents(repos, now);
  return groupEvents(list, { mode: "activity", window, grouping }, watched);
}
