import {
  groupWaits,
  listWaits,
  type OwedGrouping,
  type OwedList,
} from "../lib/owed/index.js";
import type { Thread } from "../lib/waits/index.js";
import prepareOwed from "./prepareOwed.js";
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
  return groupWaits(
    listWaits(prepareOwed(threads, watched), now, viewer),
    { mode: "owed", grouping },
    watched,
  );
}
