import { stat } from "node:fs/promises";

/**
 * A wait of at least this long, in milliseconds, is one of docket's own
 * pauses between refreshes, which the clock skips; anything shorter, such
 * as the spacing of requests, a lock's upkeep or the rest of a moving
 * selection, runs in real time.
 */
const longWait = 60_000;

/**
 * A shorter wait of `watchdogWait` or more only watches for something
 * that never came, such as a request's time limit, and is left to run out
 * after the answer. Any shorter one is work under way, which keeps docket
 * busy until it ends, even one of no time at all, as a read put off to
 * the next turn is.
 */
const watchdogWait = 5_000;

/**
 * How many turns docket must stay quiet before a skip. Each turn waits
 * for a look at a file, through the same pool that carries docket's own
 * reads and writes of its cache and its lock, which the stand-in cannot
 * see, so a file operation docket began before them has ended too. A
 * refresh takes a few of them in a row between its last request and its
 * next wait, and a loaded machine slows the turns as much as the
 * operations.
 */
const quietTurns = 20;

/** A wait the clock skips to, rather than waits for. */
interface Skipped {
  readonly due: number;
  readonly run: () => void;
  readonly handle: object;
}

/**
 * Makes a day of docket's life pass in seconds. Each wait of `longWait` or
 * more is held rather than timed. Once docket is quiet, the earliest held
 * wait ends at once and the clock moves on to its time, through
 * `moveClock`. Quiet is counted in turns, not in time: no request open,
 * no shorter wait pending, and nothing happening for `quietTurns` turns
 * in a row. The waits therefore end in the order and at the times docket
 * asked for, and everything docket does between two of them happens as
 * it would, however slowly the machine runs. Nothing is skipped before
 * `start` settles, and once the next wait would end at `span` or later,
 * `onEnd` is called instead.
 *
 * @note Impure: replaces the global `setTimeout` and `clearTimeout`, and
 * looks at a file on each turn.
 * @param span How far the clock may move on, in milliseconds.
 * @param isQuiet Whether no request is open.
 * @param start Settles once the clock may skip.
 * @returns Marks something happening just now, as a request ending does.
 */
export default function fastForward({
  span,
  isQuiet,
  moveClock,
  onEnd,
  start,
}: {
  readonly span: number;
  readonly isQuiet: () => boolean;
  readonly moveClock: (by: number) => void;
  readonly onEnd: () => void;
  readonly start: Promise<void>;
}): () => void {
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const held: Skipped[] = [];
  const busy = new Set<unknown>();
  let moved = 0;
  // Each thing that happens moves this on, and wakes the pump.
  let happened = 0;
  let wake = () => {};
  const touch = () => {
    happened += 1;
    wake();
  };
  globalThis.setTimeout = ((
    callback: (...args: unknown[]) => void,
    delay = 0,
    ...args: unknown[]
  ) => {
    if (delay >= longWait) {
      const handle = {
        ref: () => handle,
        unref: () => handle,
        hasRef: () => true,
        refresh: () => handle,
      };
      held.push({ due: moved + delay, run: () => callback(...args), handle });
      touch();
      return handle;
    }
    const timer = realSetTimeout(() => {
      busy.delete(timer);
      touch();
      callback(...args);
    }, delay);
    if (delay < watchdogWait) busy.add(timer);
    touch();
    return timer;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((handle: unknown) => {
    const at = held.findIndex((each) => each.handle === handle);
    if (at >= 0) {
      held.splice(at, 1);
      return;
    }
    if (busy.delete(handle)) touch();
    realClearTimeout(handle as Parameters<typeof clearTimeout>[0]);
  }) as typeof clearTimeout;

  /** Waits until something happens. */
  const waitForChange = () =>
    new Promise<void>((resolve) => {
      wake = () => {
        wake = () => {};
        resolve();
      };
    });
  const pump = async () => {
    await start;
    let quiet = 0;
    for (;;) {
      if (busy.size > 0 || !isQuiet() || held.length === 0) {
        quiet = 0;
        await waitForChange();
        continue;
      }
      const before = happened;
      await stat(import.meta.dirname);
      if (happened !== before) {
        quiet = 0;
        continue;
      }
      quiet += 1;
      if (quiet < quietTurns) continue;
      quiet = 0;
      held.sort((a, b) => a.due - b.due);
      const next = held.shift();
      if (!next) continue;
      if (next.due >= span) {
        onEnd();
        return;
      }
      moved = next.due;
      moveClock(moved);
      touch();
      next.run();
    }
  };
  void pump();
  return touch;
}
