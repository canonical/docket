import type { Duration } from "../lib/clock/index.js";
import type { FinishedGrouping, FinishedList } from "../lib/finished/index.js";
import buildFinished from "./buildFinished.js";
import readWindowEndings from "./readWindowEndings.js";
import type { Watched } from "./types.js";
import useWindowList, {
  type ReadHeld,
  type UseWindowListProps,
  type UseWindowListResult,
} from "./useWindowList.js";

/** Props for the useFinished hook. */
export interface UseFinishedProps
  extends Omit<UseWindowListProps<unknown, FinishedList>, "time" | "build"> {
  readonly grouping: FinishedGrouping;
  /** The instant the list is built at, so ages move with the clock. */
  readonly at: Date;
  /** The login gh is signed in with, once it is known. */
  readonly viewer?: string;
}

/**
 * finished's list, with what failed while reading its window when
 * something did; or why no repository could be read; or nothing while
 * the window on screen is being read.
 */
export type UseFinishedResult = UseWindowListResult<FinishedList>;

/** Reads each repository's finished threads for the window and times them once. */
const timeEndings = (
  read: ReadHeld,
  watched: readonly Watched[],
  window: Duration,
  now: Date,
) =>
  readWindowEndings(
    async (repo, since) => (await read(repo, since)).finished,
    watched,
    window,
    now,
  );

/**
 * Reads the threads that finished within finished's window through the
 * cache, with activity's events, and builds its list from them at every
 * instant the screen is drawn at, as `useWindowList` reads a window.
 *
 * @note Impure: reads the cache, which asks GitHub when what it holds is
 * older than the call's maximum age.
 */
export default function useFinished({
  grouping,
  at,
  viewer,
  ...props
}: UseFinishedProps): UseFinishedResult {
  return useWindowList({
    ...props,
    time: timeEndings,
    build: (endings, threads) =>
      buildFinished(
        endings,
        threads,
        props.watched,
        props.window,
        grouping,
        at,
        viewer,
      ),
  });
}
