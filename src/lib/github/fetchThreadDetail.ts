import type { ThreadDetail } from "../provider/index.js";
import type { ThreadSummary } from "../waits/index.js";
import detailFields from "./detailFields.js";
import fragments from "./fragments.js";
import GitHubError from "./GitHubError.js";
import readThreadDetail, { type DetailNode } from "./readThreadDetail.js";
import splitRepo from "./splitRepo.js";
import type { Client } from "./types.js";

const document = `query Detail($owner: String!, $name: String!, $number: Int!,
  $issue: Boolean!, $pull: Boolean!, $discussion: Boolean!) {
  ${fragments.rateLimit}
  repository(owner: $owner, name: $name) {
    issue(number: $number) @include(if: $issue) { ${detailFields.issue} }
    discussion(number: $number) @include(if: $discussion) {
      ${detailFields.discussion}
    }
    pullRequest(number: $number) @include(if: $pull) {
      ${detailFields.pullRequest}
    }
  }
}`;

interface Answer {
  readonly repository: {
    readonly issue?: DetailNode | null;
    readonly pullRequest?: DetailNode | null;
    readonly discussion?: DetailNode | null;
  };
}

/**
 * Fetches what a thread's details show: its age, labels and assignees,
 * which the snapshot holds of an open thread only; the latest comments
 * and reviews with their text; and, on a pull request, who asked for each
 * review, the files changed, each check, and its stack.
 *
 * @note Impure: reads from GitHub.
 * @throws GitHubError `GITHUB_REQUEST_FAILED` when GitHub has no such
 * thread.
 */
export default async function fetchThreadDetail(
  client: Client,
  thread: ThreadSummary,
): Promise<ThreadDetail> {
  const { owner, name } = splitRepo(thread.repo);
  const { repository } = await client.query<Answer>(document, {
    owner,
    name,
    number: thread.number,
    issue: thread.kind === "issue",
    pull: thread.kind === "pullRequest",
    discussion: thread.kind === "discussion",
  });
  const node =
    repository.issue ?? repository.pullRequest ?? repository.discussion;
  if (!node) {
    // GraphQL reports a missing thread as an error, which the client
    // throws; this covers an answer that holds no thread all the same.
    throw new GitHubError(
      "GITHUB_REQUEST_FAILED",
      `GitHub has no thread ${thread.number} in ${thread.repo}.`,
      { step: "check the thread still exists" },
    );
  }
  return readThreadDetail(node);
}
