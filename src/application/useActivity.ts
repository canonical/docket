import { useEffect, useState } from "react";
import type { ActivityGrouping, ActivityList } from "../lib/activity/index.js";
import type { CacheError } from "../lib/cache/index.js";
import type { Duration } from "../lib/clock/index.js";
import type { TimedEvent } from "../lib/events/index.js";
import type { ProviderError } from "../lib/provider/index.js";
import type { Problem } from "../lib/text/index.js";
import type { Thread } from "../lib/waits/index.js";
import buildActivity from "./buildActivity.js";
import describeFailure from "./describeFailure.js";
import isNamedError from "./isNamedError.js";
import readWindowEvents from "./readWindowEvents.js";
import type { TerminalView, Watched } from "./types.js";

/** Props for the useActivity hook. */
export interface UseActivityProps {
  /**
   * The source the interface reads from. Events are read only from a
   * cache, and only while there are threads to show.
   */
  readonly source: TerminalView["source"];
  /** The cached threads, once there is data to show. */
  readonly threads: readonly Thread[] | undefined;
  /**
   * When the cache last synced. Each sync of the refresh cycle reads the
   * events, through the cache's maximum age.
   */
  readonly syncedAt: Date | undefined;
  /** Whether activity is on screen; nothing is read while it is not. */
  readonly shown: boolean;
  readonly watched: readonly Watched[];
  readonly window: Duration;
  readonly grouping: ActivityGrouping;
  /** The current time, read whenever the events are read. */
  readonly now: () => Date;
  /** The instant the list is built at, so ages move with the clock. */
  readonly at: Date;
  /** The login gh is signed in with, once it is known. */
  readonly viewer?: string;
}

/** A failure of GitHub or the cache, which the status line names. */
type Failure = ProviderError | CacheError;

/**
 * activity's list, with what failed while reading its events when
 * something did; or why no repository's events could be read; or nothing
 * while they are being read for the window on screen.
 */
export type UseActivityResult =
  | { readonly list: ActivityList; readonly failure?: Failure }
  | { readonly problem: Problem }
  | undefined;

/** What was read last, and for which window. */
type Read = { readonly window: Duration } & (
  | {
      readonly events: ReadonlyMap<string, readonly TimedEvent[]>;
      readonly failure?: Failure;
    }
  | { readonly problem: Problem }
);

/**
 * Whether `error` is a failure GitHub or the cache names, such as no
 * answer from the network, which the other repositories' reads outlive.
 * Any other error is a defect, and stops the whole read.
 */
const isFailure = (error: unknown): error is Failure => isNamedError(error);

/**
 * Reads activity's events through the cache, and builds its list from
 * them at every instant the screen is drawn at. The events are read
 * whenever the window, the watched repositories or the cache's last
 * sync change; a list already shown for the window stays while they
 * are. When GitHub or the cache fails for a repository, the events the
 * cache holds for it answer, however old and however far back they
 * reach, and the failure goes with the list for the status line to name.
 * A repository with none held has none, so one failure never takes the
 * others' rows away; only when every repository fails with none held does
 * the failure stand in for the list.
 *
 * @note Impure: reads the cache, which asks GitHub when its events are
 * older than the call's maximum age.
 */
export default function useActivity({
  source,
  threads,
  syncedAt,
  shown,
  watched,
  window,
  grouping,
  now,
  at,
  viewer,
}: UseActivityProps): UseActivityResult {
  const [read, setRead] = useState<Read>();
  const reading = shown && threads !== undefined && "cache" in source;
  const synced = syncedAt?.getTime();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the last sync is named so that each sync reads the events.
  useEffect(() => {
    if (!reading || !("cache" in source)) return;
    const { cache, readEvents } = source;
    let current = true;
    let failure: Failure | undefined;
    let missing = 0;
    const readHeld = async (repo: string, since: Date) => {
      try {
        return (await readEvents(repo, since)).events;
      } catch (error) {
        if (!isFailure(error)) throw error;
        failure ??= error;
        const held = cache.findEvents(repo);
        if (!held) missing += 1;
        return held?.events ?? [];
      }
    };
    readWindowEvents(readHeld, watched, window, now()).then(
      (events) =>
        current &&
        setRead(
          failure && missing === watched.length
            ? { window, problem: describeFailure(failure) }
            : { window, events, ...(failure && { failure }) },
        ),
      (error: unknown) =>
        current && setRead({ window, problem: describeFailure(error) }),
    );
    return () => {
      current = false;
    };
  }, [reading, source, watched, window, now, synced]);
  if (!reading || !threads || !read || read.window !== window) {
    return undefined;
  }
  if ("problem" in read) return { problem: read.problem };
  const { events, failure } = read;
  return {
    list: buildActivity(events, threads, watched, window, grouping, at, viewer),
    ...(failure && { failure }),
  };
}
