import type { ThreadDetail } from "../lib/provider/index.js";
import type { DetailsCount } from "../lib/ui/index.js";
import type { ThreadSummary } from "../lib/waits/index.js";
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
  /**
   * Whether a read was given them, which keeps them asked for when the
   * selection moves on.
   */
  awaited: boolean;
  /**
   * True once the provider no longer found the thread, or the request
   * failed: the thread is not due again at this version, and only a read
   * asks for it again.
   */
  failed: boolean;
}

/** Threads' details asked for one at a time, read together. */
export interface DetailQueue {
  /**
   * The details of `thread` at `version`: those that arrived for it, or
   * those under way, or else, as after a read that failed, a read that
   * joins the next request.
   */
  read(thread: ThreadSummary, version: string): Promise<ThreadDetail>;
  /**
   * Whether `thread`'s details are due a read: none were asked for at
   * `version`. Details read at a version stay current until it moves,
   * however long ago they arrived, and a read that failed at `version`
   * leaves them not due.
   */
  isDue(thread: ThreadSummary, version: string): boolean;
  /**
   * Asks for the details of the threads of `window` that are due,
   * `selected` first among them, in the next request, which goes `delay`
   * milliseconds from now: a later ask before then moves it on, so moving
   * through the list reads once, the window around where it stops. The
   * threads of an earlier window not yet sent, and not in this one, give
   * way and are due again, unless a read was given them.
   */
  request(
    window: readonly WantedDetail[],
    selected: ThreadSummary | undefined,
    delay: number,
  ): void;
  /**
   * How many of the threads asked for have an answer, counted from the
   * first ask while nothing was pending until nothing is again, as when
   * the list first shows, or the selected thread alone is read again:
   * nothing while nothing is pending, or while the queue is paused. A
   * thread that gives way to a later window, or that a request leaves
   * out, is no longer counted as asked for.
   */
  countDetails(): DetailsCount | undefined;
  /** How many times details arrived for `thread`: part of its version. */
  countArrivals(thread: ThreadSummary): number;
  /** Calls `listener` whenever details arrive, or their count moves. */
  subscribe(listener: () => void): () => void;
  /**
   * Holds back every request while `paused`, as under the rate limit,
   * when GitHub refuses every request; what waits is sent once it is not.
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
 * thread the request leaves out, as the reader does below the budget
 * floor, is asked for again when it is due. A thread's details are due
 * again only when its version moves: a change GitHub records on it, or
 * one the list's roll-up of its checks shows. One the provider no longer
 * finds, or one a request that fails asked for, fails its read, and is
 * not asked for again until its version moves or a read asks for it, as
 * the accordion does when the selection comes back to it. Nothing is sent
 * while it is paused.
 *
 * @note Impure: sets a timer for each request, and reads through
 * `reader`.
 */
export default function createDetailQueue(
  reader: Pick<DetailReader, "read">,
): DetailQueue {
  const entries = new Map<string, Entry>();
  const arrivals = new Map<string, number>();
  const listeners = new Set<() => void>();
  let queued: (WantedDetail & { readonly entry: Entry })[] = [];
  let selected: ThreadSummary | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let paused = false;
  // The threads asked for since nothing was pending, and those answered.
  let round:
    | { readonly asked: Set<string>; readonly answered: Set<string> }
    | undefined;
  let sending = 0;

  const tell = () => {
    for (const listener of listeners) listener();
  };
  const countDetails = (): DetailsCount | undefined =>
    round && !paused
      ? { read: round.answered.size, asked: round.asked.size }
      : undefined;
  /** Makes `change`, telling the listeners when it moves the count. */
  const changeAndTell = <Result>(change: () => Result): Result => {
    const before = countDetails();
    const result = change();
    const after = countDetails();
    if (before?.read !== after?.read || before?.asked !== after?.asked) {
      tell();
    }
    return result;
  };
  /** Ends the round once nothing waits to be sent or is under way. */
  const settleRound = () => {
    if (queued.length === 0 && sending === 0) round = undefined;
  };
  const ask = ({ thread, version }: WantedDetail) => {
    const { promise, resolve, reject } = Promise.withResolvers<ThreadDetail>();
    // A read that fails with nobody waiting on it is no failure of the
    // process.
    promise.catch(() => {});
    const entry: Entry = {
      version,
      promise,
      settle: { resolve, reject },
      awaited: false,
      failed: false,
    };
    const key = identifyThread(thread);
    entries.set(key, entry);
    queued.push({ thread, version, entry });
    round ??= { asked: new Set(), answered: new Set() };
    round.asked.add(key);
    round.answered.delete(key);
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
    sending += 1;
    try {
      const read = await reader.read(
        ordered.map(({ thread }) => thread),
        selected,
      );
      const found = new Map(
        read.map(({ thread, detail }) => [identifyThread(thread), detail]),
      );
      for (const { key, entry } of asked) {
        if (entries.get(key) !== entry) continue;
        if (!found.has(key)) {
          entries.delete(key);
          round?.asked.delete(key);
          continue;
        }
        round?.answered.add(key);
        const detail = found.get(key);
        if (!detail) {
          entry.failed = true;
          entry.settle.reject(new Error(`${key} was not found.`));
          continue;
        }
        entry.settle.resolve(detail);
        arrivals.set(key, (arrivals.get(key) ?? 0) + 1);
      }
    } catch (reason) {
      for (const { key, entry } of asked) {
        if (entries.get(key) !== entry) continue;
        round?.answered.add(key);
        entry.failed = true;
        entry.settle.reject(reason);
      }
    }
    sending -= 1;
    settleRound();
    tell();
  };
  const isDue = (thread: ThreadSummary, version: string) =>
    entries.get(identifyThread(thread))?.version !== version;
  const schedule = (delay: number) => {
    clearTimeout(timer);
    timer = undefined;
    if (paused) return;
    timer = setTimeout(() => void flush(), delay);
  };

  return {
    read(thread, version) {
      const known = entries.get(identifyThread(thread));
      if (known?.version === version && !known.failed) {
        known.awaited = true;
        return known.promise;
      }
      const entry = changeAndTell(() => ask({ thread, version }));
      entry.awaited = true;
      if (timer === undefined) schedule(0);
      return entry.promise;
    },
    isDue,
    request: (window, chosen, delay) =>
      changeAndTell(() => {
        selected = chosen;
        const kept = new Set(
          window.map(({ thread }) => identifyThread(thread)),
        );
        queued = queued.filter(({ thread, entry }) => {
          const key = identifyThread(thread);
          if (entry.awaited || kept.has(key)) return true;
          if (entries.get(key) === entry) entries.delete(key);
          round?.asked.delete(key);
          return false;
        });
        for (const each of window) {
          if (isDue(each.thread, each.version)) ask(each);
        }
        if (queued.length > 0) schedule(delay);
        else {
          clearTimeout(timer);
          timer = undefined;
        }
        settleRound();
      }),
    countDetails,
    countArrivals: (thread) => arrivals.get(identifyThread(thread)) ?? 0,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    pause(holding) {
      changeAndTell(() => {
        paused = holding;
      });
      if (paused || queued.length > 0) schedule(0);
    },
    stop() {
      clearTimeout(timer);
      queued = [];
      round = undefined;
    },
  };
}
