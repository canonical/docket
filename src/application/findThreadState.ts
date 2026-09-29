import type { ThreadRow } from "../lib/activity/index.js";
import type { People } from "../lib/config/index.js";
import type { WaitRow } from "../lib/owed/index.js";
import type { RestingThread } from "../lib/ui/index.js";

/**
 * What activity's accordion shows for a thread: its most pressing running
 * wait, whose body tells the thread's current state as owed measures it;
 * or, when no wait runs on it, the thread at rest, with the close body,
 * the owners its row names, and the people who name its assignees and
 * whoever wrote last.
 *
 * @param waits owed's rows, most pressing first.
 * @param people Each login's group in the thread's repository.
 * @param viewer The login gh is signed in with, when it is known.
 */
export default function findThreadState(
  row: ThreadRow,
  waits: readonly WaitRow[],
  people: People,
  viewer?: string,
): WaitRow | RestingThread {
  const running = waits.find(
    (wait) => wait.reference.text === row.reference.text,
  );
  if (running) return running;
  const owners = row.owners?.fields ?? (row.owner && [row.owner]);
  return {
    repo: row.repo,
    thread: row.thread,
    ...(owners === undefined ? {} : { owners }),
    people,
    ...(viewer === undefined ? {} : { viewer }),
  };
}
