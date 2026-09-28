import { useEffect, useState } from "react";
import type { ActivityGrouping, ActivityList } from "../lib/activity/index.js";
import type { Duration } from "../lib/clock/index.js";
import type { ThreadEvent } from "../lib/events/index.js";
import type { Problem } from "../lib/text/index.js";
import type { Thread } from "../lib/waits/index.js";
import buildActivity from "./buildActivity.js";
import describeFailure from "./describeFailure.js";
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
}

/**
 * activity's list, or why its events could not be read, or nothing while
 * they are being read for the window on screen.
 */
export type UseActivityResult =
  | { readonly list: ActivityList }
  | { readonly problem: Problem }
  | undefined;

/** What was read last, and for which window. */
type Read = { readonly window: Duration } & (
  | { readonly events: ReadonlyMap<string, readonly ThreadEvent[]> }
  | { readonly problem: Problem }
);

/**
 * Reads activity's events through the cache, and builds its list from
 * them at every instant the screen is drawn at. The events are read
 * whenever the window, the watched repositories or the cache's last
 * sync change; a list already shown for the window stays while they
 * are. When GitHub or the cache fails, the events the cache holds for the
 * window answer, however old: the status line already says what went
 * wrong.
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
}: UseActivityProps): UseActivityResult {
  const [read, setRead] = useState<Read>();
  const reading = shown && threads !== undefined && "cache" in source;
  const synced = syncedAt?.getTime();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the last sync is named so that each sync reads the events.
  useEffect(() => {
    if (!reading || !("cache" in source)) return;
    const { cache, readEvents } = source;
    let current = true;
    const readHeld = async (repo: string, since: Date) => {
      try {
        return (await readEvents(repo, since)).events;
      } catch (error) {
        const held = cache.findEvents(repo, since);
        if (!held) throw error;
        return held.events;
      }
    };
    readWindowEvents(readHeld, watched, window, now()).then(
      (events) => current && setRead({ window, events }),
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
  return {
    list: buildActivity(read.events, threads, watched, window, grouping, at),
  };
}
