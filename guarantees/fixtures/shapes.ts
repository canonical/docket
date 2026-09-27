/**
 * GitHub's answers in the shapes GitHub gives them, written from GitHub's
 * API rather than from docket's sources, with neutral names only. The
 * recordings build on these.
 */
import type { RecordedAnswer } from "../types.js";

/** A person's account as GraphQL gives it. */
export const user = (login: string) => ({ login, __typename: "User" });

/** A bot's account as GraphQL gives it; its login carries no suffix. */
export const bot = (login: string) => ({ login, __typename: "Bot" });

/** One page of a GraphQL list, the last one. */
export const page = (nodes: readonly unknown[]) => ({
  pageInfo: { hasNextPage: false, endCursor: null },
  totalCount: nodes.length,
  nodes,
});

/** A comment, or a review, by `login` with its tie to the repository. */
export const comment = (
  login: string,
  createdAt: string,
  association = "MEMBER",
  body = "",
) => ({ author: user(login), authorAssociation: association, createdAt, body });

/** An open issue, as the snapshot query gives it. */
export const issueNode = (fields: {
  readonly number: number;
  readonly title: string;
  readonly createdAt: string;
  readonly author: string;
  readonly association?: string;
  readonly assignees?: readonly string[];
  readonly labels?: readonly string[];
  readonly comments?: readonly unknown[];
  readonly updatedAt?: string;
}) => ({
  number: fields.number,
  title: fields.title,
  createdAt: fields.createdAt,
  updatedAt: fields.updatedAt ?? fields.createdAt,
  state: "OPEN",
  author: user(fields.author),
  authorAssociation: fields.association ?? "NONE",
  assignees: { nodes: (fields.assignees ?? []).map(user) },
  labels: { nodes: (fields.labels ?? []).map((name) => ({ name })) },
  comments: { nodes: fields.comments ?? [] },
});

/** Where a pull request sits in its stack. */
export const stackEntry = (position: number, size: number, base: string) => ({
  position,
  stack: { number: 3, size, baseRefName: base },
});

/** A check run a GitHub App ran, finished with `conclusion`. */
export const checkRun = (
  name: string,
  conclusion: string,
  completedAt: string,
) => ({
  __typename: "CheckRun",
  name,
  status: "COMPLETED",
  conclusion,
  completedAt,
  checkSuite: { app: { slug: "example-sync" } },
});

/** The answer to a request for a repository's own file: there is none. */
export const noFile: RecordedAnswer = {
  data: { repository: { object: null } },
};

/**
 * The answer to the free check for changes: a list of one issue, tagged
 * `tag`. A request sending the tag back is answered "not modified".
 */
export const probe = (tag: string): RecordedAnswer => ({
  headers: { etag: `"${tag}"` },
  body: [{ number: 1 }],
});

/** The repository activity feed, holding no push. */
export const noPushes: RecordedAnswer = { body: [] };

/** A snapshot answer: the three lists of a repository's open threads. */
export const snapshot = (
  issues: readonly unknown[],
  pullRequests: readonly unknown[] = [],
): RecordedAnswer => ({
  data: {
    repository: {
      issues: page(issues),
      pullRequests: page(pullRequests),
      discussions: page([]),
    },
  },
});
