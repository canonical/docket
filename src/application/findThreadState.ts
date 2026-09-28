import type { ThreadRow } from "../lib/activity/index.js";
import type { WaitRow } from "../lib/owed/index.js";
import type { RestingThread } from "../lib/ui/index.js";

/**
 * What activity's accordion shows for a thread: its most pressing running
 * wait, whose body tells the thread's current state as owed measures it;
 * or, when no wait runs on it, the thread at rest, with the close body
 * and the owners its row names.
 *
 * @param waits owed's rows, most pressing first.
 */
export default function findThreadState(
  row: ThreadRow,
  waits: readonly WaitRow[],
): WaitRow | RestingThread {
  const running = waits.find(
    (wait) => wait.reference.text === row.reference.text,
  );
  if (running) return running;
  const owners =
    row.owners?.fields.map(({ text }) => text).join(", ") ?? row.owner?.text;
  return {
    repo: row.repo,
    thread: row.thread,
    ...(owners === undefined ? {} : { owners }),
  };
}
