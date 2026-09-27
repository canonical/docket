import type { Account } from "../people/index.js";
import type { ReviewCandidates, Reviewer } from "../provider/index.js";
import type { ThreadSummary } from "../waits/index.js";
import followPages from "./followPages.js";
import listAssignableUsers from "./listAssignableUsers.js";
import readAccount from "./readAccount.js";
import readReviewer from "./readReviewer.js";
import splitRepo from "./splitRepo.js";
import type { ActorNode, Client, ReviewerNode } from "./types.js";

const document = `query Candidates($owner: String!, $name: String!, $number: Int!) {
  rateLimit { limit remaining resetAt }
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewRequests(first: 100) {
        nodes { requestedReviewer { __typename ... on User { login } ... on Bot { login } ... on Team { combinedSlug } } }
      }
      suggestedReviewers { reviewer { login __typename } }
    }
  }
}`;

interface Answer {
  readonly repository: {
    readonly pullRequest: {
      readonly reviewRequests: {
        readonly nodes: readonly { readonly requestedReviewer: ReviewerNode }[];
      };
      readonly suggestedReviewers: readonly {
        readonly reviewer: NonNullable<ActorNode>;
      }[];
    } | null;
  };
}

/**
 * Lists whom the review editor offers on a pull request: the reviews
 * requested now, the people GitHub suggests from the files changed,
 * everyone who can be assigned, and the teams with access to the
 * repository, written `organisation/team`.
 *
 * @note Impure: reads from GitHub.
 */
export default async function listReviewCandidates(
  client: Client,
  pullRequest: ThreadSummary,
): Promise<ReviewCandidates> {
  const { owner, name } = splitRepo(pullRequest.repo);
  const { repository } = await client.query<Answer>(
    document,
    {
      owner,
      name,
      number: pullRequest.number,
    },
    { allowMissing: true },
  );
  const pull = repository.pullRequest;
  const requested = (pull?.reviewRequests.nodes ?? []).flatMap(
    ({ requestedReviewer }): Reviewer[] => {
      const reviewer = readReviewer(requestedReviewer);
      return reviewer ? [reviewer] : [];
    },
  );
  const suggested: Account[] = (pull?.suggestedReviewers ?? []).map(
    ({ reviewer }) => readAccount(reviewer),
  );
  const teams: string[] = [];
  await followPages<{ readonly slug: string }>(
    client,
    "GET /repos/{owner}/{repo}/teams",
    { owner, repo: name, per_page: 100 },
    (page) => {
      teams.push(...page.map(({ slug }) => `${owner}/${slug}`));
      return true;
    },
  );
  const people = await listAssignableUsers(client, pullRequest.repo);
  return { requested, suggested, people, teams };
}
