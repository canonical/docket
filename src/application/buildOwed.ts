import type { Settings } from "../lib/config/index.js";
import {
  groupWaits,
  listWaits,
  type OwedGrouping,
  type OwedList,
} from "../lib/owed/index.js";
import { findWaits, type Thread } from "../lib/waits/index.js";

/**
 * Builds owed from the cached threads: every running wait of each watched
 * repository, on the settings in effect, measured at `now`.
 */
export default function buildOwed(
  threads: readonly Thread[],
  settings: Settings,
  grouping: OwedGrouping,
  now: Date,
): OwedList {
  const { repos } = settings;
  const list = listWaits(
    repos.map((repo) => ({
      repo,
      time: settings.time,
      waits: threads
        .filter((thread) => thread.repo === repo.repo)
        .flatMap((thread) => findWaits(thread, settings)),
    })),
    now,
  );
  return groupWaits(list, { mode: "owed", grouping }, repos);
}
