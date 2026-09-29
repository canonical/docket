import type { WaitRow } from "../lib/owed/index.js";
import type { Thread, ThreadSummary } from "../lib/waits/index.js";
import buildOwed from "./buildOwed.js";
import type { Watched } from "./types.js";

/**
 * Builds owed's rows for one thread and the other pull requests of its
 * stack, most pressing first, measured at `now`: what activity's
 * accordion reads for the thread's current state and for the kinds its
 * stack lines name. Only these threads are measured, since the accordion
 * is drawn again at every tick and every key.
 *
 * @param viewer The login gh is signed in with, when it is known, which
 * the accordion marks as you among the people it names.
 */
export default function buildThreadWaits(
  thread: ThreadSummary,
  threads: readonly Thread[],
  watched: readonly Watched[],
  now: Date,
  viewer?: string,
): readonly WaitRow[] {
  const { repo, number, stack } = thread;
  const near = threads.filter(
    (each) =>
      each.repo === repo &&
      (each.number === number ||
        (stack !== undefined && each.stack?.number === stack.number)),
  );
  return buildOwed(near, watched, "none", now, viewer).groups.flatMap(
    (group) => group.rows,
  );
}
