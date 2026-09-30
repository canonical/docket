import type { ThreadDetail } from "../lib/provider/index.js";
import type { ThreadSummary } from "../lib/waits/index.js";
import { detailWindow } from "./constants.js";
import identifyThread from "./identifyThread.js";

/** What one read gives: each thread read, with its details if found. */
export type DetailReading = readonly {
  readonly thread: ThreadSummary;
  readonly detail: ThreadDetail | undefined;
}[];

/** Reads threads' details, in batches, above the budget floor. */
export interface DetailReader {
  /**
   * Reads the details of `threads`, at most `detailWindow` of them, in
   * one request. Below the budget floor only `selected` is read, when it
   * is among them; with nothing to read, nothing is asked.
   */
  read(
    threads: readonly ThreadSummary[],
    selected: ThreadSummary | undefined,
  ): Promise<DetailReading>;
}

/**
 * The reading of threads' details for the terminal interface: each read
 * is one request of at most `detailWindow` threads, which GitHub charges
 * one point. Before each request it asks whether the budget is below its
 * floor; below it, the thread the user is looking at is still read, one a
 * request, from the reserve the floor keeps for what the user asks for,
 * and no other.
 *
 * @note Impure: reads through `readDetails`.
 * @param readDetails Reads the details of several threads in one
 * request, as the provider's `threadDetails` does.
 * @param isBelowFloor Whether the budget is below its floor, asked before
 * each request.
 */
export default function createDetailReader(
  readDetails: (
    threads: readonly ThreadSummary[],
  ) => Promise<readonly (ThreadDetail | undefined)[]>,
  isBelowFloor: () => boolean,
): DetailReader {
  return {
    async read(threads, selected) {
      const chosen = isBelowFloor()
        ? threads.filter(
            (thread) =>
              selected && identifyThread(thread) === identifyThread(selected),
          )
        : threads;
      const batch = chosen.slice(0, detailWindow);
      if (batch.length === 0) return [];
      const details = await readDetails(batch);
      return batch.map((thread, index) => ({
        thread,
        detail: details.at(index),
      }));
    },
  };
}
