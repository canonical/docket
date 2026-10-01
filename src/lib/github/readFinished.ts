import type { FinishedThread } from "../endings/index.js";
import type { ThreadSummary } from "../waits/index.js";
import readAccount from "./readAccount.js";
import readAuthor from "./readAuthor.js";
import readEnding from "./readEnding.js";
import type { FinishedNode } from "./types.js";

/**
 * Reads a thread as finished when it was merged or closed at or after
 * `since` and is still so, with its ending; otherwise gives undefined. A
 * thread closed, reopened and closed again ends with its latest close,
 * whose actor ended it.
 */
export default function readFinished(
  thread: ThreadSummary,
  node: FinishedNode,
  since: Date,
): FinishedThread | undefined {
  const close = node.timelineItems.nodes.findLast(
    ({ __typename }) => __typename === "ClosedEvent",
  );
  const ending = readEnding(thread.kind, node, close);
  if (!ending || ending.at < since) return undefined;
  return {
    ...thread,
    author: readAuthor(node),
    createdAt: new Date(node.createdAt),
    draft: node.isDraft === true,
    labels: node.labels.nodes.map(({ name }) => name),
    assignees: node.assignees.nodes.map(readAccount),
    ending,
  };
}
