import type { Budget } from "../provider/index.js";

/** A REST answer: its status, its body and its headers. */
export interface RestResponse<T> {
  readonly status: number;
  readonly data: T;
  readonly headers: Readonly<Record<string, string | number | undefined>>;
}

/**
 * The one way the adapter reaches GitHub. It holds the token, keeps
 * requests in GitHub's limits, and throws only a `GitHubError`.
 */
export interface Client {
  /** Runs a GraphQL document and gives its data. */
  query<T>(document: string, variables: Record<string, unknown>): Promise<T>;
  /**
   * Sends a REST request, such as `GET /repos/{owner}/{repo}/activity`. A
   * "not modified" answer (304) comes back with its status rather than as
   * an error.
   */
  request<T>(
    route: string,
    parameters?: Record<string, unknown>,
  ): Promise<RestResponse<T>>;
  /** The rate budget the latest GraphQL answer reported, if any has. */
  lastBudget(): Budget | undefined;
}

/** An account as GraphQL gives it; `null` when the account was deleted. */
export type ActorNode = {
  readonly login: string;
  readonly __typename: string;
} | null;

/** An account as REST gives it. */
export interface RestAccount {
  readonly login: string;
  readonly type: string;
}

/** What GraphQL gives about something written, and its writer. */
export interface WrittenNode {
  readonly author: ActorNode;
  readonly authorAssociation: string;
}

/** A GraphQL list of nodes, with where the next page starts. */
export interface PageNode<T> {
  readonly pageInfo: {
    readonly hasNextPage: boolean;
    readonly endCursor: string | null;
  };
  readonly nodes: readonly T[];
}

/** A requested reviewer as GraphQL gives it. */
export type ReviewerNode = {
  readonly __typename: string;
  readonly login?: string;
  readonly combinedSlug?: string;
} | null;

/** A check on a commit: a check run, or a commit status. */
export type CheckNode =
  | {
      readonly __typename: "CheckRun";
      readonly name: string;
      readonly status: string;
      readonly conclusion: string | null;
      readonly completedAt: string | null;
      readonly checkSuite: { readonly app: { readonly slug: string } | null };
    }
  | {
      readonly __typename: "StatusContext";
      readonly context: string;
      readonly state: string;
      readonly createdAt: string;
      readonly creator: ActorNode;
    };

/** A push, as the repository activity feed records it. */
export interface FeedPush {
  readonly ref: string;
  readonly before: string;
  readonly after: string;
  readonly at: Date;
  readonly actor: RestAccount | null;
}
