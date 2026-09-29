import type { ThreadDetail } from "../lib/provider/index.js";
import type { Thread } from "../lib/waits/index.js";

/**
 * A thread's details as the snapshot holds them, marked `partial`, for
 * the accordion while reading them is paused: its times, labels and
 * assignees, and its messages without their text. Who asked for each
 * review, the files changed, the checks one by one and the stack's
 * neighbours need the read, and are left empty.
 */
export default function composeDetail(
  thread: Thread,
): ThreadDetail & { readonly partial: true } {
  const messages = [...thread.comments, ...thread.reviews]
    .toSorted((a, b) => a.at.getTime() - b.at.getTime())
    .map((message) => ({ ...message, body: "" }));
  return {
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    labels: thread.labels,
    assignees: thread.assignees,
    messages,
    requests: [],
    files: [],
    checks: [],
    partial: true,
  };
}
