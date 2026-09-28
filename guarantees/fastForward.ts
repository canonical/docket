/**
 * A wait of at least this long, in milliseconds, is one of docket's own
 * pauses between refreshes, which the clock skips; anything shorter, such
 * as the spacing of requests, a lock's upkeep or the rest of a moving
 * selection, runs in real time.
 */
const longWait = 60_000;

/**
 * A shorter wait from `busyWait` up to `watchdogWait` is work under way,
 * such as the spacing of requests or a lock's upkeep, and keeps docket
 * busy until it ends. A wait of `watchdogWait` or more but under
 * `longWait` only watches for something that never came, such as a
 * request's time limit, which is left to run out after the answer.
 */
const busyWait = 50;
const watchdogWait = 5_000;

/** How long, in real milliseconds, docket must be quiet before a skip. */
const quietFor = 150;

/** A wait the clock skips to, rather than waits for. */
interface Skipped {
  readonly due: number;
  readonly run: () => void;
  readonly handle: object;
}

/**
 * Makes a day of docket's life pass in seconds. Each wait of `longWait` or
 * more is held rather than timed; once docket is quiet, with no request
 * open, no work under way, and nothing for
 * `quietFor`, the earliest held wait ends at once and the clock moves on
 * to its time, through `moveClock`. The waits therefore end in the order
 * and at the times docket asked for, and everything docket does between
 * two of them happens as it would. Once the next wait would end at `span`
 * or later, `onEnd` is called instead.
 *
 * @note Impure: replaces the global `setTimeout` and `clearTimeout`, and
 * runs a real interval until `onEnd`.
 * @param span How far the clock may move on, in milliseconds.
 * @param isQuiet Whether no request is open.
 * @returns Marks docket busy just now, as a request ending does.
 */
export default function fastForward({
  span,
  isQuiet,
  moveClock,
  onEnd,
}: {
  readonly span: number;
  readonly isQuiet: () => boolean;
  readonly moveClock: (by: number) => void;
  readonly onEnd: () => void;
}): () => void {
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const held: Skipped[] = [];
  const busy = new Set<unknown>();
  let moved = 0;
  let lastActivity = performance.now();
  const touch = () => {
    lastActivity = performance.now();
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
      return handle;
    }
    const timer = realSetTimeout(() => {
      busy.delete(timer);
      touch();
      callback(...args);
    }, delay);
    if (delay >= busyWait && delay < watchdogWait) busy.add(timer);
    return timer;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((handle: unknown) => {
    const at = held.findIndex((each) => each.handle === handle);
    if (at >= 0) {
      held.splice(at, 1);
      return;
    }
    busy.delete(handle);
    realClearTimeout(handle as Parameters<typeof clearTimeout>[0]);
  }) as typeof clearTimeout;
  const pump = setInterval(() => {
    if (busy.size > 0 || !isQuiet()) return;
    if (performance.now() - lastActivity < quietFor) return;
    held.sort((a, b) => a.due - b.due);
    const next = held.shift();
    if (!next) return;
    if (next.due >= span) {
      clearInterval(pump);
      onEnd();
      return;
    }
    moved = next.due;
    moveClock(moved);
    touch();
    next.run();
  }, 10);
  return touch;
}
