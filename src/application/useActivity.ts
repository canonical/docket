import type { ActivityGrouping, ActivityList } from "../lib/activity/index.js";
import type { Duration } from "../lib/clock/index.js";
import buildActivity from "./buildActivity.js";
import readWindowEvents from "./readWindowEvents.js";
import type { Watched } from "./types.js";
import useWindowList, {
  type ReadHeld,
  type UseWindowListProps,
  type UseWindowListResult,
} from "./useWindowList.js";

/** Props for the useActivity hook. */
export interface UseActivityProps
  extends Omit<UseWindowListProps<unknown, ActivityList>, "time" | "build"> {
  readonly grouping: ActivityGrouping;
  /** The instant the list is built at, so ages move with the clock. */
  readonly at: Date;
  /** The login gh is signed in with, once it is known. */
  readonly viewer?: string;
}

/**
 * activity's list, with what failed while reading its events when
 * something did; or why no repository's events could be read; or nothing
 * while they are being read for the window on screen.
 */
export type UseActivityResult = UseWindowListResult<ActivityList>;

/** Reads each repository's events for the window and times them once. */
const timeEvents = (
  read: ReadHeld,
  watched: readonly Watched[],
  window: Duration,
  now: Date,
) =>
  readWindowEvents(
    async (repo, since) => (await read(repo, since)).events,
    watched,
    window,
    now,
  );

/**
 * Reads activity's events through the cache, and builds its list from
 * them at every instant the screen is drawn at, as `useWindowList` reads
 * a window.
 *
 * @note Impure: reads the cache, which asks GitHub when its events are
 * older than the call's maximum age.
 */
export default function useActivity({
  grouping,
  at,
  viewer,
  ...props
}: UseActivityProps): UseActivityResult {
  return useWindowList({
    ...props,
    time: timeEvents,
    build: (events, threads) =>
      buildActivity(
        events,
        threads,
        props.watched,
        props.window,
        grouping,
        at,
        viewer,
      ),
  });
}
