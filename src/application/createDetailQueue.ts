import type { ThreadDetail } from "../lib/provider/index.js";
import type { ThreadSummary } from "../lib/waits/index.js";
import { detailStaleAfter } from "./constants.js";
import type { DetailReader } from "./createDetailReader.js";
import identifyThread from "./identifyThread.js";

/** A thread whose details are asked for, and its version on the list. */
export interface WantedDetail {
  readonly thread: ThreadSummary;
  /** What the list shows of the thread's last change. */
  readonly version: string;
}

/** What the queue knows of one thread's details. */
interface Entry {
  /** The thread's version when they were asked for. */
  readonly version: string;
  readonly promise: Promise<ThreadDetail>;
  readonly settle: {
    readonly resolve: (detail: ThreadDetail) => void;
    readonly reject: (reason: unknown) => void;
  };
  /** When they arrived, once they have. */
  readAt?: number;
}

/** Threads' details asked for one at a time, read together. */
export interface DetailQueue {
  /**
   * The details of `thread` at `version`: those that arrived for it, or
   * those under way, or else a read that joins the next request.
   */
  read(thread: ThreadSummary, version: string): Promise<ThreadDetail>;
  /**
   * Whether `thread`'s details are due a read at `at`: none were asked
   * for at `version`, or those that arrived are `detailStaleAfter` old.
   */
  isDue(thread: ThreadSummary, version: string, at: Date): boolean;
  /**
   * Asks for the details of `wanted`, `selected` first among them, in
   * the next request, which goes `delay` milliseconds from now: a later
   * ask before then moves it on, so moving through the list reads once.
   */
  request(
    wanted: readonly WantedDetail[],
    selected: ThreadSummary | undefined,
    delay: number,
  ): void;
  /** How many times details arrived for `thread`: part of its version. */
  countArrivals(thread: ThreadSummary): number;
  /** Calls `listener` whenever details arrive. */
  subscribe(listener: () => void): () => void;
  /**
   * Holds back every request while `paused`, as below the budget floor or
   * under the rate limit, when no point may be spent; what waits is sent
   * once it is not.
   */
  pause(paused: boolean): void;
  /** Sends nothing more, when the pane closes. */
  stop(): void;
}

/**
 * Gathers the reads of threads' details into requests through `reader`,
 * at most `detailWindow` threads each, so the selected thread and those
 * around it cost one point together. A read asked for alone goes at once,
 * unless an ask for the rows around it is pending, which it joins. A
 * thread the request leaves out, once the hour's budget is spent, is
 * asked for again when it is due; one the provider no longer finds, or a
 * request that fails, fails its read, and it is read again when asked.
 * Nothing is sent while it is paused.
 *
 * @note Impure: sets a timer for each request, and reads through
 * `reader`.
 */
export default function createDetailQueue(
  reader: Pick<DetailReader, "read">,
  now: () => Date,
): DetailQueue {
  const entries = new Map<string, Entry>();
  const arrivals = new Map<string, number>();
  const listeners = new Set<() => void>();
  let queued: (WantedDetail & { readonly entry: Entry })[] = [];
  let selected: ThreadSummary | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let paused = false;

  const ask = ({ thread, version }: WantedDetail) => {
    const { promise, resolve, reject } = Promise.withResolvers<ThreadDetail>();
    // A read that fails with nobody waiting on it is no failure of the
    // process.
    promise.catch(() => {});
    const entry: Entry = { version, promise, settle: { resolve, reject } };
    entries.set(identifyThread(thread), entry);
    queued.push({ thread, version, entry });
    return entry;
  };
  const flush = async () => {
    timer = undefined;
    // A thread asked for twice is read once, at the version asked last.
    const batch = [
      ...new Map(
        queued.map((each) => [identifyThread(each.thread), each]),
      ).values(),
    ];
    queued = [];
    const first = selected && identifyThread(selected);
    const ordered = [
      ...batch.filter(({ thread }) => identifyThread(thread) === first),
      ...batch.filter(({ thread }) => identifyThread(thread) !== first),
    ];
    const asked = ordered.map(({ thread, entry }) => ({
      key: identifyThread(thread),
      entry,
    }));
    const at = now();
    try {
      const read = await reader.read(
        ordered.map(({ thread }) => thread),
        selected,
        at,
      );
      const found = new Map(
        read.map(({ thread, detail }) => [identifyThread(thread), detail]),
      );
      for (const { key, entry } of asked) {
        if (entries.get(key) !== entry) continue;
        if (!found.has(key)) {
          entries.delete(key);
          continue;
        }
        const detail = found.get(key);
        if (!detail) {
          entries.delete(key);
          entry.settle.reject(new Error(`${key} was not found.`));
          continue;
        }
        entry.readAt = at.getTime();
        entry.settle.resolve(detail);
        arrivals.set(key, (arrivals.get(key) ?? 0) + 1);
      }
      for (const listener of listeners) listener();
    } catch (reason) {
      for (const { key, entry } of asked) {
        if (entries.get(key) !== entry) continue;
        entries.delete(key);
        entry.settle.reject(reason);
      }
    }
  };
  const schedule = (delay: number) => {
    clearTimeout(timer);
    timer = undefined;
    if (paused) return;
    timer = setTimeout(() => void flush(), delay);
  };

  return {
    read(thread, version) {
      const known = entries.get(identifyThread(thread));
      if (known?.version === version) return known.promise;
      const entry = ask({ thread, version });
      if (timer === undefined) schedule(0);
      return entry.promise;
    },
    isDue(thread, version, at) {
      const known = entries.get(identifyThread(thread));
      if (known?.version !== version) return true;
      return (
        known.readAt !== undefined &&
        at.getTime() - known.readAt >= detailStaleAfter
      );
    },
    request(wanted, chosen, delay) {
      selected = chosen;
      for (const each of wanted) ask(each);
      schedule(delay);
    },
    countArrivals: (thread) => arrivals.get(identifyThread(thread)) ?? 0,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    pause(holding) {
      paused = holding;
      if (paused || queued.length > 0) schedule(0);
    },
    stop() {
      clearTimeout(timer);
      queued = [];
    },
  };
}
