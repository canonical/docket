import type { ThreadDetail } from "../lib/provider/index.js";
import type { ThreadSummary } from "../lib/waits/index.js";
import { detailBudgetPerHour, detailWindow } from "./constants.js";
import identifyThread from "./identifyThread.js";

/** An hour, in milliseconds: the span the details budget counts over. */
const hour = 3_600_000;

/** What one read gives: each thread read, with its details if found. */
export type DetailReading = readonly {
  readonly thread: ThreadSummary;
  readonly detail: ThreadDetail | undefined;
}[];

/** Reads threads' details, in batches, within the hourly budget. */
export interface DetailReader {
  /**
   * Reads the details of `threads`, at most `detailWindow` of them, in
   * one request at `at`. Once the hour's budget is spent, only `selected`
   * is read, when it is among them; with nothing to read, nothing is
   * asked.
   */
  read(
    threads: readonly ThreadSummary[],
    selected: ThreadSummary | undefined,
    at: Date,
  ): Promise<DetailReading>;
  /** Whether the hour's budget for details is spent at `at`. */
  isCapped(at: Date): boolean;
}

/**
 * The reading of threads' details for the terminal interface: each read
 * is one request of at most `detailWindow` threads, which GitHub charges
 * one point, and counts against `detailBudgetPerHour`. The hour starts at
 * the first read after the last one ended.
 *
 * @note Impure: reads through `readDetails`, and counts what it spent.
 * @param readDetails Reads the details of several threads in one
 * request, as the provider's `threadDetails` does.
 */
export default function createDetailReader(
  readDetails: (
    threads: readonly ThreadSummary[],
  ) => Promise<readonly (ThreadDetail | undefined)[]>,
): DetailReader {
  let hourStart = Number.NEGATIVE_INFINITY;
  let spent = 0;
  const isCapped = (at: Date) =>
    at.getTime() - hourStart < hour && spent >= detailBudgetPerHour;
  return {
    isCapped,
    async read(threads, selected, at) {
      const chosen = isCapped(at)
        ? threads.filter(
            (thread) =>
              selected && identifyThread(thread) === identifyThread(selected),
          )
        : threads;
      const batch = chosen.slice(0, detailWindow);
      if (batch.length === 0) return [];
      if (at.getTime() - hourStart >= hour) {
        hourStart = at.getTime();
        spent = 0;
      }
      spent += 1;
      const details = await readDetails(batch);
      return batch.map((thread, index) => ({
        thread,
        detail: details.at(index),
      }));
    },
  };
}
