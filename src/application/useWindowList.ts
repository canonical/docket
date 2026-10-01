import { useEffect, useState } from "react";
import type { CachedEvents, CacheError } from "../lib/cache/index.js";
import type { Duration } from "../lib/clock/index.js";
import type { ProviderError } from "../lib/provider/index.js";
import type { Problem } from "../lib/text/index.js";
import type { Thread } from "../lib/waits/index.js";
import describeFailure from "./describeFailure.js";
import isNamedError from "./isNamedError.js";
import type { TerminalView, Watched } from "./types.js";

/** Gives a repository's events and finished threads at or after a time. */
export type ReadHeld = (repo: string, since: Date) => Promise<CachedEvents>;

/** Props for the useWindowList hook. */
export interface UseWindowListProps<Timed, List> {
  /**
   * The source the interface reads from. Events are read only from a
   * cache, and only while there are threads to show.
   */
  readonly source: TerminalView["source"];
  /** The cached threads, once there is data to show. */
  readonly threads: readonly Thread[] | undefined;
  /**
   * When the cache last synced. Each sync of the refresh cycle reads the
   * window again, through the cache's maximum age.
   */
  readonly syncedAt: Date | undefined;
  /** Whether the mode is on screen; nothing is read while it is not. */
  readonly shown: boolean;
  readonly watched: readonly Watched[];
  readonly window: Duration;
  /** The current time, read whenever the window is read. */
  readonly now: () => Date;
  /**
   * Reads each watched repository through `read` and times what the mode
   * lists against the window, once for each read. It is the same function
   * at every draw, as one defined once is.
   */
  readonly time: (
    read: ReadHeld,
    watched: readonly Watched[],
    window: Duration,
    now: Date,
  ) => Promise<Timed>;
  /** Builds the list from what was read and timed, at each draw. */
  readonly build: (timed: Timed, threads: readonly Thread[]) => List;
}

/** A failure of GitHub or the cache, which the status line names. */
type Failure = ProviderError | CacheError;

/**
 * The mode's list, with what failed while reading its window when
 * something did; or why no repository could be read; or nothing while
 * the window on screen is being read.
 */
export type UseWindowListResult<List> =
  | { readonly list: List; readonly failure?: Failure }
  | { readonly problem: Problem }
  | undefined;

/** What was read last, and for which window. */
type Read<Timed> = { readonly window: Duration } & (
  | { readonly timed: Timed; readonly failure?: Failure }
  | { readonly problem: Problem }
);

/**
 * Whether `error` is a failure GitHub or the cache names, such as no
 * answer from the network, which the other repositories' reads outlive.
 * Any other error is a defect, and stops the whole read.
 */
const isFailure = (error: unknown): error is Failure => isNamedError(error);

/**
 * Reads a windowed mode's data through the cache, activity's events or
 * finished's threads, and builds its list from it at every instant the
 * screen is drawn at. The window is read whenever it, the watched
 * repositories or the cache's last sync change; a list already shown for
 * the window stays while it is. Below the budget floor, what the cache
 * holds for the window answers however old, and only a window it holds
 * nothing of is read. When GitHub or the cache fails for a
 * repository, what the cache holds for it answers, however old and
 * however far back it reaches, and the failure goes with the list for
 * the status line to name. A repository with nothing held has nothing,
 * so one failure never takes the others' rows away; only when every
 * repository fails with nothing held does the failure stand in for the
 * list.
 *
 * @note Impure: reads the cache, which asks GitHub when what it holds is
 * older than the call's maximum age.
 */
export default function useWindowList<Timed, List>({
  source,
  threads,
  syncedAt,
  shown,
  watched,
  window,
  now,
  time,
  build,
}: UseWindowListProps<Timed, List>): UseWindowListResult<List> {
  const [read, setRead] = useState<Read<Timed>>();
  const reading = shown && threads !== undefined && "cache" in source;
  const synced = syncedAt?.getTime();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the last sync is named so that each sync reads the window.
  useEffect(() => {
    if (!reading || !("cache" in source)) return;
    const { cache, readEvents } = source;
    let current = true;
    let failure: Failure | undefined;
    let missing = 0;
    const readHeld: ReadHeld = async (repo, since) => {
      // Below the budget floor, reading again what the cache holds is
      // docket's own spending, which waits for the reset; a window it
      // holds nothing of is the user's own request, and is read.
      const kept = cache.findEvents(repo, since);
      if (kept && !cache.maySpend()) return kept;
      try {
        return await readEvents(repo, since);
      } catch (error) {
        if (!isFailure(error)) throw error;
        failure ??= error;
        const held = cache.findEvents(repo);
        if (!held) missing += 1;
        return held ?? { events: [], finished: [], syncedAt: now() };
      }
    };
    time(readHeld, watched, window, now()).then(
      (timed) =>
        current &&
        setRead(
          failure && missing === watched.length
            ? { window, problem: describeFailure(failure) }
            : { window, timed, ...(failure && { failure }) },
        ),
      (error: unknown) =>
        current && setRead({ window, problem: describeFailure(error) }),
    );
    return () => {
      current = false;
    };
  }, [reading, source, watched, window, now, time, synced]);
  if (!reading || !threads || !read || read.window !== window) {
    return undefined;
  }
  if ("problem" in read) return { problem: read.problem };
  const { timed, failure } = read;
  return { list: build(timed, threads), ...(failure && { failure }) };
}
