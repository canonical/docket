import type { Push, Thread } from "../waits/index.js";
import readAuthor from "./readAuthor.js";
import readChecks from "./readChecks.js";
import readIssue from "./readIssue.js";
import readReviewRequests from "./readReviewRequests.js";
import type { PullNode } from "./types.js";

/**
 * Reads the facts the snapshot gives about a pull request in `repo`. The
 * pushes come from the activity feed, and a team's members from GitHub's
 * teams, so both are given.
 *
 * @param members The members of each team a review was requested from.
 */
export default function readPullRequest(
  repo: string,
  node: PullNode,
  pushes: readonly Push[],
  members: ReadonlyMap<string, readonly string[]>,
): Thread {
  const entry = node.stackEntry;
  const checks = readChecks(
    node.commits.nodes.at(-1)?.commit.statusCheckRollup?.state,
  );
  return {
    ...readIssue(repo, node),
    kind: "pullRequest",
    draft: node.isDraft,
    // A review GitHub has not submitted yet is a draft only its writer sees.
    reviews: node.latestReviews.nodes.flatMap((review) =>
      review.submittedAt
        ? [{ author: readAuthor(review), at: new Date(review.submittedAt) }]
        : [],
    ),
    reviewRequests: readReviewRequests(node.timelineItems.nodes, members),
    pushes,
    ...(checks ? { checks } : {}),
    ...(entry
      ? {
          stack: {
            number: entry.stack.number,
            position: entry.position,
            size: entry.stack.size,
            base: entry.stack.baseRefName,
          },
        }
      : {}),
  };
}
