import type { ReviewRequest } from "../waits/index.js";
import readAccount from "./readAccount.js";
import readReviewer from "./readReviewer.js";
import type { RequestNode } from "./types.js";

/**
 * Reads the review requests still standing from a pull request's timeline:
 * for each reviewer, the latest request that no later withdrawal
 * cancelled, with who asked for it when GitHub names them. A team's
 * members come from `members`, keyed by the team's name, and a team
 * missing from it has none listed.
 */
export default function readReviewRequests(
  nodes: readonly RequestNode[],
  members: ReadonlyMap<string, readonly string[]>,
): ReviewRequest[] {
  const standing = new Map<string, ReviewRequest>();
  const ordered = [...nodes].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  for (const node of ordered) {
    const reviewer = readReviewer(node.requestedReviewer);
    if (!reviewer) continue;
    const name = "team" in reviewer ? reviewer.team : reviewer.login;
    const key = name.toLowerCase();
    if (node.__typename === "ReviewRequestRemovedEvent") {
      standing.delete(key);
      continue;
    }
    standing.set(key, {
      reviewer:
        "team" in reviewer
          ? { team: name, members: members.get(name) ?? [] }
          : reviewer,
      at: new Date(node.createdAt),
      // A requester whose account was deleted reads as GitHub shows it.
      ...(node.actor === undefined
        ? {}
        : { requester: readAccount(node.actor) }),
    });
  }
  return [...standing.values()];
}
