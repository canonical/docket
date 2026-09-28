import type { Thread } from "../waits/index.js";
import readAccount from "./readAccount.js";
import readAuthor from "./readAuthor.js";
import type { IssueNode } from "./types.js";

/** Reads the facts the snapshot gives about an issue in `repo`. */
export default function readIssue(repo: string, node: IssueNode): Thread {
  return {
    repo,
    number: node.number,
    url: node.url,
    kind: "issue",
    title: node.title,
    author: readAuthor(node),
    createdAt: new Date(node.createdAt),
    open: node.state === "OPEN",
    draft: false,
    labels: node.labels.nodes.map(({ name }) => name),
    assignees: node.assignees.nodes.map(readAccount),
    comments: node.comments.nodes.map((comment) => ({
      author: readAuthor(comment),
      at: new Date(comment.createdAt),
    })),
    reviews: [],
    reviewRequests: [],
    pushes: [],
  };
}
