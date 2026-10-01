/**
 * GitHub's answers in the shapes GitHub gives them, written from GitHub's
 * API rather than from docket's sources, with neutral names only. The
 * recordings build on these.
 */
import type { RecordedAnswer } from "../types.js";

/** A person's account as GraphQL gives it. */
export const buildUser = (login: string) => ({ login, __typename: "User" });

/** A bot's account as GraphQL gives it; its login carries no suffix. */
export const buildBot = (login: string) => ({ login, __typename: "Bot" });

/** One page of a GraphQL list, the last one. */
export const buildPage = (nodes: readonly unknown[]) => ({
  pageInfo: { hasNextPage: false, endCursor: null },
  totalCount: nodes.length,
  nodes,
});

/**
 * A comment, or a review, by `login` with its tie to the repository, and
 * its text: as Markdown for a thread's details, as plain text for the
 * snapshot.
 */
export const buildComment = (
  login: string,
  createdAt: string,
  association = "MEMBER",
  body = "",
) => ({
  author: buildUser(login),
  authorAssociation: association,
  createdAt,
  body,
  bodyText: body,
});

/** An open issue, as the snapshot query gives it. */
export const buildIssueNode = (fields: {
  readonly number: number;
  /** The thread's page on GitHub. */
  readonly url: string;
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
  url: fields.url,
  title: fields.title,
  createdAt: fields.createdAt,
  updatedAt: fields.updatedAt ?? fields.createdAt,
  state: "OPEN",
  author: buildUser(fields.author),
  authorAssociation: fields.association ?? "NONE",
  assignees: { nodes: (fields.assignees ?? []).map(buildUser) },
  labels: { nodes: (fields.labels ?? []).map((name) => ({ name })) },
  comments: { nodes: fields.comments ?? [] },
});

/** Where a pull request sits in its stack. */
export const buildStackEntry = (
  position: number,
  size: number,
  base: string,
) => ({
  position,
  stack: { number: 3, size, baseRefName: base },
});

/** A check run a GitHub App ran, finished with `conclusion`. */
export const buildCheckRun = (
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

/**
 * The answer to the free check for changes: a list of one issue, tagged
 * `tag`. A request sending the tag back is answered "not modified".
 */
export const buildProbe = (tag: string): RecordedAnswer => ({
  headers: { etag: `"${tag}"` },
  body: [{ number: 1 }],
});

/** A snapshot answer: the three lists of a repository's open threads. */
export const buildSnapshot = (
  issues: readonly unknown[],
  pullRequests: readonly unknown[] = [],
): RecordedAnswer => ({
  data: {
    repository: {
      issues: buildPage(issues),
      pullRequests: buildPage(pullRequests),
      discussions: buildPage([]),
    },
  },
});

/**
 * How an issue or pull request stands, as the events query gives it: its
 * state, when it closed, and its labels and assignees.
 */
export const buildStanding = (
  state: string,
  closedAt: string | null = null,
  labels: readonly string[] = [],
  assignees: readonly string[] = [],
) => ({
  state,
  closedAt,
  labels: { nodes: labels.map((name) => ({ name })) },
  assignees: { nodes: assignees.map(buildUser) },
});
