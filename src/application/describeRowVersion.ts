import type { Thread } from "../lib/waits/index.js";
import type { ListRow } from "./types.js";

/** A thread's last change, as GitHub records it, and its checks. */
const describeChange = ({ updatedAt, checks }: Thread) =>
  `${updatedAt.getTime()}|${checks ?? ""}`;

/**
 * A row's version, which reads its thread's details again when it moves:
 * the thread's last change, as GitHub records it, and its checks, for
 * owed's wait, which carries its thread, and for a thread the data holds;
 * else, as for a closed thread, its ending in finished, or its newest
 * event in activity.
 *
 * @param facts The row's thread as the data holds it, when it does.
 */
export default function describeRowVersion(
  row: ListRow,
  facts: Thread | undefined,
): string {
  if ("wait" in row) return describeChange(row.wait.thread);
  if (facts) return describeChange(facts);
  if ("ending" in row) return `${row.thread.ending.at.getTime()}`;
  return `${row.events.at(0)?.event.at.getTime()}`;
}
