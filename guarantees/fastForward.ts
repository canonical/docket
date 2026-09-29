import { stat } from "node:fs/promises";

/**
 * A wait of at least this long, in milliseconds, is one of docket's own
 * pauses, between refreshes or between checks of the selected thread,
 * which the clock skips; anything shorter, such as the spacing of
 * requests, a lock's upkeep or the rest of a moving selection, runs in
 * real time.
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

/** A handle for a wait the clock skips to, as a timer's handle behaves. */
interface Handle {
  ref(): Handle;
  unref(): Handle;
  hasRef(): boolean;
  refresh(): Handle;
}

/** A wait the clock skips to, rather than waits for. */
interface Skipped {
  readonly due: number;
  readonly run: () => void;
  readonly handle: Handle;
}

const makeHandle = (): Handle => {
  let referenced = true;
  const handle: Handle = {
    ref: () => {
      referenced = true;
      return handle;
    },
    unref: () => {
      referenced = false;
      return handle;
    },
    hasRef: () => referenced,
    refresh: () => handle,
  };
  return handle;
};

/**
 * Makes a day of docket's life pass in seconds. Each wait of `longWait` or
 * more, once or on repeat, is held rather than timed. Once docket is
 * quiet, the earliest held wait ends at once and the clock moves on to
 * its time, through `moveClock`; a wait on repeat is held again from
 * there. Quiet is counted in turns, not in time: no request open, no
 * shorter wait pending, and nothing happening for `quietTurns` turns in a
 * row. The waits therefore end in the order and at the times docket asked
 * for, and everything docket does between two of them happens as it
 * would, however slowly the machine runs. A wait whose handle is unref'd,
 * such as a library's housekeeping, keeps nothing alive, so the clock
 * never stops for it: it ends as the clock passes it. Nothing is skipped
 * before `start` settles, and once the next wait would end at `span` or
 * later, `onEnd` is called instead.
 *
 * @note Impure: replaces the global `setTimeout`, `clearTimeout`,
 * `setInterval` and `clearInterval`, and looks at a file on each turn.
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
  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
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
  const hold = (due: number, run: () => void, handle: Handle) => {
    held.push({ due, run, handle });
    touch();
  };
  const release = (handle: unknown) => {
    const at = held.findIndex((each) => each.handle === handle);
    if (at >= 0) held.splice(at, 1);
    return at >= 0;
  };
  globalThis.setTimeout = ((
    callback: (...args: unknown[]) => void,
    delay = 0,
    ...args: unknown[]
  ) => {
    if (delay >= longWait) {
      const handle = makeHandle();
      hold(moved + delay, () => callback(...args), handle);
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
    if (release(handle)) return;
    if (busy.delete(handle)) touch();
    realClearTimeout(handle as Parameters<typeof clearTimeout>[0]);
  }) as typeof clearTimeout;
  globalThis.setInterval = ((
    callback: (...args: unknown[]) => void,
    delay = 0,
    ...args: unknown[]
  ) => {
    if (delay < longWait) return realSetInterval(callback, delay, ...args);
    const handle = makeHandle();
    const repeat = () =>
      hold(
        moved + delay,
        () => {
          repeat();
          callback(...args);
        },
        handle,
      );
    repeat();
    return handle;
  }) as typeof setInterval;
  globalThis.clearInterval = ((handle: unknown) => {
    if (release(handle)) return;
    realClearInterval(handle as Parameters<typeof clearInterval>[0]);
  }) as typeof clearInterval;

  /** Waits until something happens. */
  const waitForChange = () =>
    new Promise<void>((resolve) => {
      wake = () => {
        wake = () => {};
        resolve();
      };
    });
  /** The earliest held wait that `accept` takes, taken out of the hold. */
  const takeEarliest = (accept: (each: Skipped) => boolean) => {
    held.sort((a, b) => a.due - b.due);
    const at = held.findIndex(accept);
    return at >= 0 ? held.splice(at, 1).at(0) : undefined;
  };
  /** Moves the clock on to `wait`'s time, and ends it. */
  const end = (wait: Skipped) => {
    moved = wait.due;
    moveClock(moved);
    wait.run();
  };
  const pump = async () => {
    await start;
    let quiet = 0;
    for (;;) {
      const next = held
        .filter(({ handle }) => handle.hasRef())
        .sort((a, b) => a.due - b.due)
        .at(0);
      if (busy.size > 0 || !isQuiet() || !next) {
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
      if (next.due >= span) {
        onEnd();
        return;
      }
      for (;;) {
        const passed = takeEarliest(
          (each) => !each.handle.hasRef() && each.due <= next.due,
        );
        if (!passed) break;
        end(passed);
      }
      if (!release(next.handle)) continue;
      touch();
      end(next);
    }
  };
  void pump();
  return touch;
}
