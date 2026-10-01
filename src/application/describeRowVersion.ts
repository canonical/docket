import type { ThreadRow as ActivityThread } from "../lib/activity/index.js";
import type { Thread } from "../lib/waits/index.js";
import type { ListRow } from "./types.js";

/**
 * A row's version, which reads its thread's details again when it moves:
 * the thread's last change, as GitHub records it, and its checks, while
 * the data holds the thread; else, as for a closed thread, its ending in
 * finished, or its newest event in activity.
 *
 * @param facts The row's thread as the data holds it, when it does.
 */
export default function describeRowVersion(
  row: ListRow,
  facts: Thread | undefined,
): string {
  if (facts) return `${facts.updatedAt.getTime()}|${facts.checks ?? ""}`;
  if ("ending" in row) return `${row.thread.ending.at.getTime()}`;
  return `${(row as ActivityThread).events.at(0)?.event.at.getTime()}`;
}
