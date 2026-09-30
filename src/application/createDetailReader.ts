import type { ThreadDetail } from "../lib/provider/index.js";
import type { ThreadSummary } from "../lib/waits/index.js";
import { detailWindow } from "./constants.js";
import identifyThread from "./identifyThread.js";

/** What one read gives: each thread read, with its details if found. */
export type DetailReading = readonly {
  readonly thread: ThreadSummary;
  readonly detail: ThreadDetail | undefined;
}[];

/** Reads threads' details in batches, ahead only above the floor. */
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
 * one point. Before each request it asks whether docket may read ahead:
 * reading the rows around the selection is docket's own spending, which
 * stops below the budget floor, while the thread the user is looking at
 * is their own request, still read, one a request, from the reserve.
 *
 * @note Impure: reads through `readDetails`.
 * @param readDetails Reads the details of several threads in one
 * request, as the provider's `threadDetails` does.
 * @param mayReadAhead Whether docket may spend points of its own, asked
 * before each request.
 */
export default function createDetailReader(
  readDetails: (
    threads: readonly ThreadSummary[],
  ) => Promise<readonly (ThreadDetail | undefined)[]>,
  mayReadAhead: () => boolean,
): DetailReader {
  return {
    async read(threads, selected) {
      const chosen = mayReadAhead()
        ? threads
        : threads.filter(
            (thread) =>
              selected && identifyThread(thread) === identifyThread(selected),
          );
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
