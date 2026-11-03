import { useEffect, useState } from "react";
import type {
  AttentionState,
  CachedEvents,
  CacheError,
} from "../lib/cache/index.js";
import type { Duration } from "../lib/clock/index.js";
import type { ProviderError } from "../lib/provider/index.js";
import type { Problem } from "../lib/text/index.js";
import type { Thread } from "../lib/waits/index.js";
import describeFailure from "./describeFailure.js";
import findWindowStart from "./findWindowStart.js";
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
  /**
   * Whether the mode is on screen. Both windowed modes read their
   * windows, on screen or not, so a switch of mode finds its list
   * already read; below the budget floor, only the mode on screen reads
   * a window the cache holds nothing of, as the user's own request.
   */
  readonly shown: boolean;
  /**
   * The pane's attention, which the reads follow: an idle pane reads no
   * window again, and a list it holds stays until a key wakes it, as the
   * details read ahead does. Absent when nothing follows the pane's
   * attention, and then never idle.
   */
  readonly attention?: AttentionState;
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
 * The mode's list, with when the oldest data it was built from was
 * fetched, and what failed while reading its window when something did;
 * or why no repository could be read; or nothing while the window is
 * being read.
 */
export type UseWindowListResult<List> =
  | {
      readonly list: List;
      /** When the oldest data the list was built from was fetched. */
      readonly readAt?: Date;
      readonly failure?: Failure;
      /** Cached data does not yet cover every watched repository. */
      readonly partial?: boolean;
    }
  | { readonly problem: Problem }
  | undefined;

/** What was read last, and for which window. */
type Read<Timed> = { readonly window: Duration } & (
  | {
      readonly timed: Timed;
      readonly readAt?: Date;
      readonly failure?: Failure;
      readonly partial?: boolean;
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
 * Reads a windowed mode's data through the cache, activity's events or
 * finished's threads, and builds its list from it at every instant the
 * screen is drawn at. What the cache holds for the window serves at
 * once, however old, so the first switch to the mode finds a list on
 * screen while the read that follows brings it up to date in place; a
 * window the cache holds nothing of keeps the loading line until that
 * read settles. When only some repositories are held, their rows show
 * with a partial count until the read settles. The window
 * is read whenever it, the watched repositories or the cache's last sync
 * change, for the mode on screen and for the one behind it alike, so a
 * switch of mode finds its list already read; a list already shown for
 * the window stays while it is, and an idle pane reads no window again,
 * however old what it holds, until a key wakes it. Below the budget
 * floor, what the cache holds for the window answers, however old, and
 * a window the cache holds nothing of waits for the reset unless its
 * mode is on screen, where the user's own request reads it: a read the
 * floor stops never settles, so the window is read whole at the next
 * sync above the floor, never in part. When GitHub or the cache fails
 * for a repository, what the cache holds for it answers, however old and
 * however far back it reaches, and the failure goes with the list for
 * the status line to name. A repository with nothing held has nothing,
 * so one failure never takes the others' rows away; only when every
 * repository fails with nothing held does the failure stand in for the
 * list. The list carries when the oldest data it was built from was
 * fetched, so the status line's age names the data on screen, the older
 * of the threads and the window, as text mode's freshness does.
 *
 * @note Impure: reads the cache, which asks GitHub when what it holds is
 * older than the call's maximum age.
 */
export default function useWindowList<Timed, List>({
  source,
  threads,
  syncedAt,
  shown,
  attention,
  watched,
  window,
  now,
  time,
  build,
}: UseWindowListProps<Timed, List>): UseWindowListResult<List> {
  const [read, setRead] = useState<Read<Timed>>();
  const reading = threads !== undefined && "cache" in source;
  // An idle pane reads no window again: a list it holds stays, however
  // old, until a key wakes the pane.
  const awake = (attention ?? "active") !== "idle";
  const synced = syncedAt?.getTime();
  // Switching modes need only restart a read when it releases the reserve.
  const reserveRequested =
    shown && "cache" in source && !source.cache.maySpend();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a sync triggers a read; read is only used to decide whether to seed it from the cache.
  useEffect(() => {
    if (!reading || !awake || !("cache" in source)) return;
    const { cache, readEvents } = source;
    let current = true;
    let failure: Failure | undefined;
    let missing = 0;
    /** The oldest answer this read was built from, the age its list carries. */
    let readAt: Date | undefined;
    const note = (at: Date) => {
      readAt = !readAt || at < readAt ? at : readAt;
    };
    // Take one snapshot of the covered repositories before timing it.
    // An incomplete window is explicitly marked partial.
    if (!read || read.window !== window) {
      const at = now();
      const held = watched.map(({ repo, resolved }) => {
        const since = findWindowStart(window, resolved.settings, at);
        const covered = cache.findEvents(repo, since);
        return {
          repo,
          covered: covered !== undefined,
          data: covered ?? cache.findEvents(repo),
        };
      });
      if (held.some(({ data }) => data !== undefined) || held.length === 0) {
        const complete = held.every(({ covered }) => covered);
        const byRepo = new Map(
          held.flatMap(({ repo, data }) =>
            data ? [[repo, data] as const] : [],
          ),
        );
        const heldAt = held.reduce<Date | undefined>(
          (oldest, { data }) =>
            data && (!oldest || data.syncedAt < oldest)
              ? data.syncedAt
              : oldest,
          undefined,
        );
        const serveHeld: ReadHeld = async (repo) =>
          byRepo.get(repo) ?? { events: [], finished: [], syncedAt: at };
        time(serveHeld, watched, window, at).then(
          (timed) => {
            if (!current) return;
            setRead((previous) =>
              previous && previous.window === window
                ? previous
                : {
                    window,
                    timed,
                    ...(!complete && { partial: true }),
                    ...(heldAt && { readAt: heldAt }),
                  },
            );
          },
          // The fresh read reports failures; a failed cache snapshot must
          // not replace a newer answer that arrived before it.
          () => {},
        );
      }
    }
    const readHeld: ReadHeld = async (repo, since) => {
      // The preceding request can finish after this effect was cleaned up.
      // Do not start another repository once the pane is idle or moved on.
      if (!current) return new Promise<CachedEvents>(() => {});
      const kept = cache.findEvents(repo, since);
      // Below the budget floor, reading again what the cache holds is
      // docket's own spending, which waits for the reset; a window it
      // holds nothing of is the user's own request only while the mode
      // is on screen, and otherwise waits for the reset too, its read
      // never settling, so no part of it is taken as the window.
      if (!cache.maySpend()) {
        if (kept) {
          note(kept.syncedAt);
          return kept;
        }
        if (!reserveRequested) return new Promise<CachedEvents>(() => {});
      }
      try {
        const fresh = await readEvents(repo, since);
        note(fresh.syncedAt);
        return fresh;
      } catch (error) {
        if (!isFailure(error)) throw error;
        failure ??= error;
        const held = cache.findEvents(repo);
        if (!held) missing += 1;
        const answer = held ?? { events: [], finished: [], syncedAt: now() };
        if (held) note(held.syncedAt);
        return answer;
      }
    };
    time(readHeld, watched, window, now()).then(
      (timed) => {
        if (!current) return;
        setRead(
          failure && missing === watched.length
            ? { window, problem: describeFailure(failure) }
            : {
                window,
                timed,
                ...(readAt && { readAt }),
                ...(failure && { failure }),
              },
        );
      },
      (error: unknown) => {
        if (!current) return;
        setRead({ window, problem: describeFailure(error) });
      },
    );
    return () => {
      current = false;
    };
  }, [
    reading,
    awake,
    source,
    reserveRequested,
    watched,
    window,
    now,
    time,
    synced,
  ]);
  if (!shown || !reading || !threads || !read || read.window !== window) {
    return undefined;
  }
  if ("problem" in read) return { problem: read.problem };
  const { timed, failure, readAt } = read;
  return {
    list: build(timed, threads),
    readAt,
    ...(read.partial && { partial: true }),
    ...(failure && { failure }),
  };
}
