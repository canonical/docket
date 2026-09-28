import type {
  DetailMessage,
  RequestDetail,
  StackMember,
  ThreadDetail,
} from "../provider/index.js";
import readAccount from "./readAccount.js";
import readAuthor from "./readAuthor.js";
import readCheck from "./readCheck.js";
import readReviewer from "./readReviewer.js";
import type {
  ActorNode,
  CheckNode,
  ReviewerNode,
  WrittenNode,
} from "./types.js";

type MessageNode = WrittenNode & { readonly body: string };

/** A thread as GraphQL gives the fields `detailFields` selects. */
export interface DetailNode {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly labels: { readonly nodes: readonly { readonly name: string }[] };
  readonly assignees?: { readonly nodes: readonly NonNullable<ActorNode>[] };
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

const readMessage = (node: MessageNode, at: string): DetailMessage => ({
  author: readAuthor(node),
  at: new Date(at),
  body: node.body,
});

/**
 * Reads what a thread's details show from GraphQL's answer: its age,
 * labels and assignees; the latest comments and reviews with their text,
 * oldest first, leaving out a review not yet submitted; and, on a pull
 * request, who asked for each review, the files changed, each check, and
 * its stack.
 */
export default function readThreadDetail(node: DetailNode): ThreadDetail {
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
    createdAt: new Date(node.createdAt),
    updatedAt: new Date(node.updatedAt),
    labels: node.labels.nodes.map(({ name }) => name),
    assignees: (node.assignees?.nodes ?? []).map(readAccount),
    messages,
    requests,
    files: node.files?.nodes ?? [],
    checks: contexts.map(readCheck).map(({ name, state }) => ({ name, state })),
    ...(stack ? { stack } : {}),
  };
}
