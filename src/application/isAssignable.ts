import type { Assignable } from "../lib/provider/index.js";
import type { Thread } from "../lib/waits/index.js";

/** Whether a thread can have assignees: discussions have none. */
export default function isAssignable(
  thread: Thread,
): thread is Thread & Assignable {
  return thread.kind !== "discussion";
}
