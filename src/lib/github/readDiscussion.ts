import type { Thread } from "../waits/index.js";
import readAuthor from "./readAuthor.js";
import type { CommentNode, DiscussionNode } from "./types.js";

const readMessage = (comment: CommentNode) => ({
  author: readAuthor(comment),
  at: new Date(comment.createdAt),
});

/**
 * Reads the facts the snapshot gives about a discussion in `repo`. A
 * reply to a comment is a message as much as the comment is.
 */
export default function readDiscussion(
  repo: string,
  node: DiscussionNode,
): Thread {
  return {
    repo,
    number: node.number,
    kind: "discussion",
    title: node.title,
    author: readAuthor(node),
    createdAt: new Date(node.createdAt),
    open: !node.closed,
    draft: false,
    labels: node.labels.nodes.map(({ name }) => name),
    assignees: [],
    comments: node.comments.nodes
      .flatMap((comment) => [comment, ...comment.replies.nodes])
      .map(readMessage),
    reviews: [],
    reviewRequests: [],
    pushes: [],
  };
}
