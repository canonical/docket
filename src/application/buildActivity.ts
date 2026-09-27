import {
  type ActivityGrouping,
  type ActivityList,
  groupEvents,
  listEvents,
} from "../lib/activity/index.js";
import { type Duration, measureDuration } from "../lib/clock/index.js";
import type { Settings } from "../lib/config/index.js";
import { selectEvents } from "../lib/events/index.js";
import type { Provider } from "../lib/provider/index.js";
import type { Thread } from "../lib/waits/index.js";

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
 * within the window of working time before `now`, under their threads.
 * Events are not cached, so each call asks GitHub for them; the cached
 * threads give each row its owners.
 */
export default async function buildActivity(
  provider: Provider,
  threads: readonly Thread[],
  settings: Settings,
  window: Duration,
  grouping: ActivityGrouping,
  now: Date,
): Promise<ActivityList> {
  const since = findEarliest(window, settings, now);
  const repos = [];
  for (const repo of settings.repos) {
    const events = await provider.events(repo.repo, since);
    repos.push({
      repo,
      people: settings.people,
      threads: threads.filter((thread) => thread.repo === repo.repo),
      events: selectEvents(events, window, now, settings),
    });
  }
  const list = listEvents(repos, now);
  return groupEvents(
    list,
    { mode: "activity", window, grouping },
    settings.repos,
  );
}
