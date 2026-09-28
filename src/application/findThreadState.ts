import type { ThreadRow } from "../lib/activity/index.js";
import type { WaitRow } from "../lib/owed/index.js";
import type { RestingThread } from "../lib/ui/index.js";
import type { Thread } from "../lib/waits/index.js";

/**
 * What activity's accordion shows for a thread: its most pressing running
 * wait, whose body tells the thread's current state as owed measures it;
 * or, when no wait runs on it, the thread at rest, with the close body.
 * The cache holds open threads only, so a closed thread rests with what
 * its row knows.
 *
 * @param waits owed's rows, most pressing first.
 * @param threads The cached threads, whose facts give a thread at rest its
 * age and labels.
 */
export default function findThreadState(
  row: ThreadRow,
  waits: readonly WaitRow[],
  threads: readonly Thread[],
): WaitRow | RestingThread {
  const running = waits.find(
    (wait) => wait.reference.text === row.reference.text,
  );
  if (running) return running;
  const { repo, number, url, kind, title, stack } = row.thread;
  const facts = threads.find(
    (thread) => thread.repo === repo && thread.number === number,
  );
  // Only the summary, whatever else the event carried: the facts are the
  // cache's, so a thread at rest never shows an age the cache does not hold.
  const summary = { repo, number, url, kind, title, ...(stack && { stack }) };
  const owners =
    row.owners?.fields.map(({ text }) => text).join(", ") ?? row.owner?.text;
  return {
    repo: row.repo,
    thread: facts ?? summary,
    ...(owners === undefined ? {} : { owners }),
  };
}
