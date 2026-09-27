import type {
  DetailMessage,
  RequestDetail,
  StackMember,
  ThreadDetail,
} from "../provider/index.js";
import type { ThreadSummary } from "../waits/index.js";
import fragments from "./fragments.js";
import GitHubError from "./GitHubError.js";
import readAccount from "./readAccount.js";
import readAuthor from "./readAuthor.js";
import readCheck from "./readCheck.js";
import readReviewer from "./readReviewer.js";
import splitRepo from "./splitRepo.js";
import type {
  ActorNode,
  CheckNode,
  Client,
  ReviewerNode,
  WrittenNode,
} from "./types.js";

const { account, check, requestedReviewer } = fragments;
const written = `${fragments.written} body`;
const comments = `comments(last: 3) { nodes { ${written} createdAt } }`;

const document = `query Detail($owner: String!, $name: String!, $number: Int!,
  $issue: Boolean!, $pull: Boolean!, $discussion: Boolean!) {
  ${fragments.rateLimit}
  repository(owner: $owner, name: $name) {
    issue(number: $number) @include(if: $issue) { updatedAt ${comments} }
    discussion(number: $number) @include(if: $discussion) { updatedAt ${comments} }
    pullRequest(number: $number) @include(if: $pull) {
      updatedAt ${comments}
      reviews(last: 3) { nodes { ${written} submittedAt } }
      timelineItems(last: 30, itemTypes: [REVIEW_REQUESTED_EVENT]) {
        nodes {
          ... on ReviewRequestedEvent {
            createdAt actor { ${account} }
            ${requestedReviewer}
          }
        }
      }
      files(first: 100) { nodes { path additions deletions } }
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              contexts(first: 50) { nodes { ${check} } }
            }
          }
        }
      }
      stack { entries(first: 20) { nodes { position pullRequest { number state } } } }
    }
  }
}`;

type MessageNode = WrittenNode & { readonly body: string };

interface DetailNode {
  readonly updatedAt: string;
  readonly comments: {
    readonly nodes: readonly (MessageNode & { readonly createdAt: string })[];
  };
  readonly reviews?: {
    readonly nodes: readonly (MessageNode & {
      readonly submittedAt: string | null;
    })[];
  };
  readonly timelineItems?: {
    readonly nodes: readonly {
      readonly createdAt: string;
      readonly actor: ActorNode;
      readonly requestedReviewer: ReviewerNode;
    }[];
  };
  readonly files?: {
    readonly nodes: readonly {
      readonly path: string;
      readonly additions: number;
      readonly deletions: number;
    }[];
  } | null;
  readonly commits?: {
    readonly nodes: readonly {
      readonly commit: {
        readonly statusCheckRollup: {
          readonly contexts: { readonly nodes: readonly CheckNode[] };
        } | null;
      };
    }[];
  };
  readonly stack?: {
    readonly entries: {
      readonly nodes: readonly {
        readonly position: number;
        readonly pullRequest: {
          readonly number: number;
          readonly state: string;
        };
      }[];
    };
  } | null;
}

interface Answer {
  readonly repository: {
    readonly issue?: DetailNode | null;
    readonly pullRequest?: DetailNode | null;
    readonly discussion?: DetailNode | null;
  };
}

const readMessage = (node: MessageNode, at: string): DetailMessage => ({
  author: readAuthor(node),
  at: new Date(at),
  body: node.body,
});

/**
 * Fetches what a thread's details show beyond the snapshot: the latest
 * comments and reviews with their text and, on a pull request, who asked
 * for each review, the files changed, each check, and its stack.
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
      "check the thread still exists, then refresh",
    );
  }
  const messages = [
    ...node.comments.nodes.map((comment) =>
      readMessage(comment, comment.createdAt),
    ),
    ...(node.reviews?.nodes ?? []).flatMap((review) =>
      review.submittedAt ? [readMessage(review, review.submittedAt)] : [],
    ),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const requests = (node.timelineItems?.nodes ?? []).flatMap(
    (event): RequestDetail[] => {
      const reviewer = readReviewer(event.requestedReviewer);
      if (!reviewer) return [];
      return [
        {
          reviewer,
          requester: readAccount(event.actor),
          at: new Date(event.createdAt),
        },
      ];
    },
  );
  const contexts =
    node.commits?.nodes.at(-1)?.commit.statusCheckRollup?.contexts.nodes ?? [];
  const stack = node.stack?.entries.nodes.map(
    ({ position, pullRequest }): StackMember => ({
      position,
      number: pullRequest.number,
      state: pullRequest.state.toLowerCase() as StackMember["state"],
    }),
  );
  return {
    updatedAt: new Date(node.updatedAt),
    messages,
    requests,
    files: node.files?.nodes ?? [],
    checks: contexts.map(readCheck).map(({ name, state }) => ({ name, state })),
    ...(stack ? { stack } : {}),
  };
}
