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
  /**
   * Runs a GraphQL document and gives its data. GitHub answers a node it
   * does not find, such as a pull request by a number that was deleted,
   * with `null` there and a `NOT_FOUND` error; with `allowMissing`, such
   * an answer gives its data, the node `null`, rather than an error.
   */
  query<T>(
    document: string,
    variables: Record<string, unknown>,
    options?: { readonly allowMissing?: boolean },
  ): Promise<T>;
  /**
   * Sends a REST request, such as `GET /repos/{owner}/{repo}/activity`. A
   * "not modified" answer (304) comes back with its status rather than as
   * an error.
   */
  request<T>(
    route: string,
    parameters?: Record<string, unknown>,
  ): Promise<RestResponse<T>>;
  /**
   * Runs a GraphQL document over every page of the one list it reads,
   * which starts each page at `$cursor`, and gives its data with every
   * node of that list. A list whose owner GitHub gives as `null`, such as
   * a team hidden from the reader, stays `null`.
   */
  paginate<T>(document: string, variables: Record<string, unknown>): Promise<T>;
  /**
   * Reads a REST list page by page, following the link GitHub gives to
   * the next page; leaving the loop early reads no further page.
   */
  pages<T>(
    route: string,
    parameters?: Record<string, unknown>,
  ): AsyncIterable<readonly T[]>;
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

/** A comment as GraphQL gives it. */
export interface CommentNode extends WrittenNode {
  readonly createdAt: string;
}

/** What the snapshot gives about every issue and pull request. */
export interface IssueNode extends WrittenNode {
  readonly number: number;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** `OPEN`, `CLOSED`, or `MERGED` for a pull request. */
  readonly state: string;
  readonly assignees: { readonly nodes: readonly NonNullable<ActorNode>[] };
  readonly labels: { readonly nodes: readonly { readonly name: string }[] };
  readonly comments: { readonly nodes: readonly CommentNode[] };
}

/** A review requested or withdrawn, from a pull request's timeline. */
export interface RequestNode {
  readonly __typename: string;
  readonly createdAt: string;
  readonly requestedReviewer: ReviewerNode;
}

/** Where a pull request sits in its stack; `null` outside one. */
export type StackEntryNode = {
  readonly position: number;
  readonly stack: {
    readonly number: number;
    readonly size: number;
    readonly baseRefName: string;
  };
} | null;

/** A pull request's head commit, as GraphQL gives it. */
export interface HeadCommitNode {
  readonly committedDate: string;
  /** The account the commit's author is linked to, if any. */
  readonly author: { readonly user: { readonly login: string } | null } | null;
  readonly statusCheckRollup: { readonly state: string } | null;
}

/** What the snapshot gives about a pull request besides the above. */
export interface PullNode extends IssueNode {
  readonly isDraft: boolean;
  readonly headRefName: string;
  /** True when the branch lives in a fork. */
  readonly isCrossRepository: boolean;
  readonly latestReviews: {
    readonly nodes: readonly (WrittenNode & {
      readonly submittedAt: string | null;
    })[];
  };
  /** The latest reviews requested. */
  readonly requested: { readonly nodes: readonly RequestNode[] };
  /** The latest requests withdrawn. */
  readonly withdrawn: { readonly nodes: readonly RequestNode[] };
  readonly commits: {
    readonly nodes: readonly { readonly commit: HeadCommitNode }[];
  };
  readonly stackEntry: StackEntryNode;
}

/** What the snapshot gives about a discussion. */
export interface DiscussionNode extends WrittenNode {
  readonly number: number;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closed: boolean;
  readonly labels: { readonly nodes: readonly { readonly name: string }[] };
  readonly comments: {
    readonly nodes: readonly (CommentNode & {
      readonly replies: { readonly nodes: readonly CommentNode[] };
    })[];
  };
}
