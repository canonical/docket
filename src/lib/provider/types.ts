import type { ThreadEvent } from "../events/index.js";
import type { Account, Author } from "../people/index.js";
import type {
  Checks,
  Message,
  Team,
  Thread,
  ThreadSummary,
} from "../waits/index.js";

/**
 * The facts a provider may or may not supply. A view leaves out whatever
 * its provider does not declare, such as the `by stack` grouping without
 * `stacks`.
 */
export type Capability =
  /** Discussions, besides issues and pull requests. */
  | "discussions"
  /** Pull requests stacked natively, each with its place in the stack. */
  | "stacks"
  /** Reviews requested from a team rather than a person. */
  | "teamReviews"
  /** The combined state of each pull request's checks. */
  | "checks"
  /** Bots told apart from people by their account type. */
  | "botAccounts"
  /** Each push of commits, with its time and the account that made it. */
  | "pushes"
  /** A check for changes that costs nothing when nothing changed. */
  | "changeProbe";

/**
 * Where the last snapshot of a repository ended, so the next one fetches
 * only what changed since. It holds only JSON values, so it can be kept on
 * disk beside the data.
 */
export interface Cursor {
  /**
   * An instant on the provider's clock, never the reader's: threads
   * updated at or after it are fetched.
   */
  readonly since: string;
}

/** The threads of one repository that changed since a cursor. */
export interface Snapshot {
  /**
   * With no cursor, every open thread. With one, every thread updated since
   * it, in any state, so a thread that closed replaces its open copy.
   */
  readonly threads: readonly Thread[];
  /**
   * Where the next snapshot starts. `null` when nothing was seen to start
   * from, so the next snapshot fetches everything.
   */
  readonly cursor: Cursor | null;
}

/**
 * How far a snapshot has read: pages fetched out of the total. Each page
 * reads the next part of every list at once, so the total is the page
 * count of the longest list. A snapshot since a cursor may stop before it.
 */
export interface PageProgress {
  readonly fetched: number;
  readonly total: number;
}

/** The answer of the check for changes in a repository. */
export interface ChangeProbe {
  /** False when nothing the check covers changed since `tag`. */
  readonly changed: boolean;
  /** What to pass to the next check. */
  readonly tag: string | undefined;
}

/** The checks of one pull request, read again. */
export interface CheckRefresh {
  readonly repo: string;
  readonly number: number;
  /** Absent when no check ran on the head commit. */
  readonly checks?: Checks;
}

/** A comment or review with its text, as the thread's details show it. */
export interface DetailMessage extends Message {
  readonly author: Author;
  readonly body: string;
}

/** Who asked a reviewer for a review, and when. */
export interface RequestDetail {
  readonly reviewer: Reviewer;
  readonly requester: Account;
  readonly at: Date;
}

/** A file a pull request changes, and its lines added and removed. */
export interface FileChange {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
}

/** One check on a pull request's head commit. */
export interface CheckDetail {
  readonly name: string;
  readonly state: Checks;
}

/** A pull request in a stack, as the thread's details list it. */
export interface StackMember {
  readonly position: number;
  readonly number: number;
  readonly state: "open" | "closed" | "merged";
}

/**
 * Everything a thread's details show that the snapshot leaves out, and
 * the facts the snapshot holds of an open thread only: its age, labels
 * and assignees, which a closed thread shows too.
 */
export interface ThreadDetail {
  /** When the thread was opened. */
  readonly createdAt: Date;
  /** When anything on the thread last changed. */
  readonly updatedAt: Date;
  /** Its labels' names, as written, such as `kind: bug`. */
  readonly labels: readonly string[];
  /** Its assignees; a discussion has none. */
  readonly assignees: readonly Account[];
  /** The latest comments and reviews with their text, oldest first. */
  readonly messages: readonly DetailMessage[];
  /** The review requests, on a pull request, oldest first. */
  readonly requests: readonly RequestDetail[];
  /** The files changed, on a pull request. */
  readonly files: readonly FileChange[];
  /** The checks on the head commit, on a pull request. */
  readonly checks: readonly CheckDetail[];
  /** The pull requests of its stack, bottom first, when it sits in one. */
  readonly stack?: readonly StackMember[];
}

/**
 * A person or a team that can be asked for a review. A team is named as
 * the model names it, without its members.
 */
export type Reviewer = Account | Pick<Team, "team">;

/** Whom the review editor offers, in the order it lists them. */
export interface ReviewCandidates {
  /** The reviews requested now, still unanswered. */
  readonly requested: readonly Reviewer[];
  /** The people GitHub suggests, from the files changed. */
  readonly suggested: readonly Account[];
  /** Everyone who can be requested. */
  readonly people: readonly Account[];
  /** The teams of the organisation that owns the repository. */
  readonly teams: readonly Pick<Team, "team">[];
}

/** A thread that can have assignees: discussions have none. */
export type Assignable = ThreadSummary & {
  readonly kind: "issue" | "pullRequest";
};

/** One rate budget, as an answer reported it. */
export interface Budget {
  readonly limit: number;
  readonly remaining: number;
  /** When the budget is full again. */
  readonly resetAt: Date;
}

/**
 * The rate budgets the provider's answers report, each kept apart since
 * each has its own limit: `graphql` for its queries and `rest` for its
 * other requests. Each is absent until an answer of its kind has come.
 */
export interface Budgets {
  readonly graphql?: Budget;
  readonly rest?: Budget;
}

/**
 * The named codes of provider errors. This is the one list of them.
 * Callers and scripts depend on the codes, so a code is never renamed or
 * reused.
 */
export type ProviderErrorCode =
  | "GH_NOT_INSTALLED"
  | "GH_NOT_SIGNED_IN"
  | "GH_TIMED_OUT"
  | "GITHUB_RATE_LIMITED"
  | "GITHUB_REQUEST_FAILED"
  | "GITHUB_TIMED_OUT"
  | "GITHUB_UNREACHABLE";

/**
 * An error a provider throws. It never carries the token, a request's
 * headers or a request's body.
 */
export interface ProviderError extends Error {
  readonly code: ProviderErrorCode;
  /** What to do so the next attempt works. */
  readonly recovery: string;
  /**
   * The recovery before its last part, when that part is to refresh: a
   * face that cannot refresh from where the user is ends `step` with its
   * own way to try again.
   */
  readonly step?: string;
}

/**
 * What the core asks of a source of threads. It offers what the views
 * need and no more; the token stays inside the provider.
 */
export interface Provider {
  /**
   * The threads of `repo` changed since `cursor`, or every open thread
   * when it is `null`. `onPage` hears of each page as it arrives.
   */
  snapshot(
    repo: string,
    cursor: Cursor | null,
    onPage?: (progress: PageProgress) => void,
  ): Promise<Snapshot>;
  /**
   * The checks of the given pull requests, which change without marking
   * a pull request as updated.
   */
  refreshVolatile(
    threads: readonly ThreadSummary[],
  ): Promise<readonly CheckRefresh[]>;
  /** The events on `repo`'s threads at or after `since`, for activity. */
  events(repo: string, since: Date): Promise<readonly ThreadEvent[]>;
  threadDetail(thread: ThreadSummary): Promise<ThreadDetail>;
  /**
   * The details of every thread given, in the order given, read in one
   * request, which costs no more than reading one when there are few:
   * `undefined` in the place of a thread the provider no longer finds.
   */
  threadDetails(
    threads: readonly ThreadSummary[],
  ): Promise<readonly (ThreadDetail | undefined)[]>;
  /** Everyone who can be assigned in `repo`. */
  assignableUsers(repo: string): Promise<readonly Account[]>;
  reviewCandidates(pullRequest: ThreadSummary): Promise<ReviewCandidates>;
  /** The thread's assignees as GitHub records them now, never a copy. */
  readAssignees(thread: Assignable): Promise<readonly Account[]>;
  /**
   * Makes `logins` the thread's whole set of assignees, removing anyone
   * else, and gives the set that results.
   */
  setAssignees(
    thread: Assignable,
    logins: readonly string[],
  ): Promise<readonly Account[]>;
  /**
   * Makes `reviewers` the whole set of reviews requested on the pull
   * request, removing any other request, and gives the set that results.
   */
  setReviewers(
    pullRequest: ThreadSummary,
    reviewers: readonly Reviewer[],
  ): Promise<readonly Reviewer[]>;
  /** The logins of a team's members. */
  teamMembers(team: Pick<Team, "team">): Promise<readonly string[]>;
  /** Whether anything changed in `repo` since the check that gave `tag`. */
  probe(repo: string, tag: string | undefined): Promise<ChangeProbe>;
  /**
   * The text of the file at `path` on `repo`'s default branch, or
   * `undefined` when there is none.
   */
  readFile(repo: string, path: string): Promise<string | undefined>;
  /**
   * The budgets the latest answer of each kind reported, a refusal or
   * "not modified" included. It asks nothing.
   */
  readBudgets(): Budgets;
  /** The login of the account the provider acts as. */
  viewer(): Promise<string>;
  capabilities(): ReadonlySet<Capability>;
}
