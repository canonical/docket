/**
 * GitHub's answers in the shapes GitHub gives them, written from GitHub's
 * API rather than from docket's sources, with neutral names only. The
 * recordings build on these.
 */
import type { RecordedAnswer } from "../types.js";

/** A person's account as GraphQL gives it. */
export const user = (login: string) => ({ login, __typename: "User" });

/** One page of a GraphQL list, the last one. */
export const page = (nodes: readonly unknown[]) => ({
  pageInfo: { hasNextPage: false, endCursor: null },
  totalCount: nodes.length,
  nodes,
});

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

/** A snapshot answer: the three lists of a repository's open threads. */
export const snapshot = (issues: readonly unknown[]): RecordedAnswer => ({
  data: {
    repository: {
      issues: page(issues),
      pullRequests: page([]),
      discussions: page([]),
    },
  },
});
