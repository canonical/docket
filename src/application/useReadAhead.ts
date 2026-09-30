import { useEffect, useRef, useState } from "react";
import type { AttentionState, CacheStatus } from "../lib/cache/index.js";
import type { ThreadDetail } from "../lib/provider/index.js";
import type { DetailsCount } from "../lib/ui/index.js";
import type { ThreadSummary } from "../lib/waits/index.js";
import { detailRest, detailWindow } from "./constants.js";
import createDetailQueue, { type WantedDetail } from "./createDetailQueue.js";
import type { DetailReader } from "./createDetailReader.js";
import identifyThread from "./identifyThread.js";

/** Props for the useReadAhead hook. */
export interface UseReadAheadProps {
  /**
   * Reads threads' details in batches above the budget floor; without it,
   * nothing is read ahead, and the accordion reads alone.
   */
  readonly reader: DetailReader | undefined;
  /** Each row's thread and its version, in the order drawn. */
  readonly rows: readonly WantedDetail[];
  /** The place of the selected row among them. */
  readonly selected: number;
  /** The pane's attention: an idle pane reads nothing ahead. */
  readonly attention: AttentionState;
  /**
   * Why the refresh cycle is paused, if it is: nothing is read ahead then.
   * Below the budget floor the selected thread is still read; under the
   * rate limit, when GitHub refuses every request, nothing is, and the
   * accordion's read waits until the pause ends.
   */
  readonly paused: NonNullable<CacheStatus["paused"]>["reason"] | undefined;
}

/**
 * Result of the useReadAhead hook: how the accordion reads a thread's
 * details, which joins the reads ahead, when there is a reader; the
 * version the details held for it key on, which moves whenever details
 * read ahead arrive for it; and how many of the details asked for have
 * been read, while any are pending.
 */
export interface UseReadAheadResult {
  readonly read?: (
    thread: ThreadSummary,
    version: string,
  ) => Promise<ThreadDetail>;
  readonly version: (thread: ThreadSummary, version: string) => string;
  readonly progress?: DetailsCount;
}

/** The rows nearest `place` first, each thread once, at most `limit`. */
function findNearest(
  rows: readonly WantedDetail[],
  place: number,
  limit: number,
): WantedDetail[] {
  const byDistance = rows
    .map((row, index) => ({ row, distance: Math.abs(index - place), index }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index);
  const seen = new Set<string>();
  const nearest: WantedDetail[] = [];
  for (const { row } of byDistance) {
    const key = identifyThread(row.thread);
    if (seen.has(key)) continue;
    seen.add(key);
    nearest.push(row);
    if (nearest.length === limit) break;
  }
  return nearest;
}

/**
 * Reads ahead the details of the selected thread and the rows around it,
 * at most `detailWindow` threads in one request: at once when the list
 * first shows, and `detailRest` after the selection last moved, for the
 * threads whose details are missing or out of date: read at a version the
 * row no longer shows. Nothing is read ahead while the pane is idle or the refresh cycle
 * paused: below the budget floor only the selected thread is read, and
 * under the rate limit nothing is, the accordion's own read included.
 * Details read ahead reach the accordion through the details it holds,
 * by the version they move: old details stay on screen until new ones
 * arrive. It draws again whenever details arrive or the count of
 * those read moves.
 *
 * @note Impure: reads through the reader, and sets its timers.
 */
export default function useReadAhead({
  reader,
  rows,
  selected,
  attention,
  paused,
}: UseReadAheadProps): UseReadAheadResult {
  const [queue] = useState(() => reader && createDetailQueue(reader));
  useEffect(() => () => queue?.stop(), [queue]);
  const [, redraw] = useState(0);
  useEffect(
    () => queue?.subscribe(() => redraw((count) => count + 1)),
    [queue],
  );
  useEffect(() => queue?.pause(paused === "rateLimit"), [queue, paused]);
  const moved = useRef(false);
  const chosen = rows.at(selected);
  const window = findNearest(rows, selected, detailWindow);
  const key = window
    .map(({ thread, version }) => `${identifyThread(thread)}@${version}`)
    .join(" ");
  const chosenKey = chosen && identifyThread(chosen.thread);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the window's key names what it holds.
  useEffect(() => {
    if (!queue || attention === "idle" || paused === "rateLimit" || !chosen) {
      return;
    }
    const delay = moved.current ? detailRest : 0;
    moved.current = true;
    // Below the budget floor the selected thread alone is asked for.
    queue.request(paused ? [chosen] : window, chosen.thread, delay);
  }, [queue, key, chosenKey, attention, paused]);
  if (!queue) return { version: (_thread, version) => version };
  const progress = queue.countDetails();
  return {
    read: (thread, version) => queue.read(thread, version),
    version: (thread, version) => `${version}|${queue.countArrivals(thread)}`,
    ...(progress && { progress }),
  };
}
