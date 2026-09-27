import type { Duration } from "../clock/index.js";
import type { Targets } from "../config/index.js";
import type { Account, Author } from "../people/index.js";
import type { StackEntry } from "../stacks/index.js";

/** The kinds of thread, named as the close targets name them. */
export type ThreadKind = keyof Targets["close"];

/** What names a thread and places it in the lists. */
export interface ThreadSummary {
  /** `owner/name` on GitHub. */
  readonly repo: string;
  readonly number: number;
  readonly kind: ThreadKind;
  readonly title: string;
  /** Where the pull request sits in a stack, when it sits in one. */
  readonly stack?: StackEntry;
}

/** A message on a thread: a comment, or a submitted review. */
export interface Message {
  readonly author: Author;
  readonly at: Date;
}

/** A GitHub team, and the logins of its members. */
export interface Team {
  /** The team as GitHub names it, such as `example-org/reviewers`. */
  readonly team: string;
  readonly members: readonly string[];
}

/**
 * The latest request for a reviewer's review that no later withdrawal
 * cancelled, as the pull request's timeline records it. It stays after the
 * reviewer reviews: GitHub drops a reviewer from its pending list once they
 * review, yet a push after that review needs their review once more.
 */
export interface ReviewRequest {
  readonly reviewer: Account | Team;
  /** When the review was requested. */
  readonly at: Date;
}

/** A thread and the facts recorded on it. */
export interface Thread extends ThreadSummary {
  readonly author: Author;
  readonly createdAt: Date;
  /** False once the thread is closed or merged, whatever the reason. */
  readonly open: boolean;
  readonly draft: boolean;
  readonly labels: readonly string[];
  readonly assignees: readonly Account[];
  readonly comments: readonly Message[];
  /** Submitted reviews, on a pull request. */
  readonly reviews: readonly Message[];
  /** The reviews requested, on a pull request: one entry per reviewer. */
  readonly reviewRequests: readonly ReviewRequest[];
  /** When commits were pushed, on a pull request. */
  readonly pushes: readonly Date[];
}

/**
 * The kinds of wait: time to the next move, as a response or a review, and
 * time to close.
 */
export type WaitKind = "response" | "review" | "close";

/** A running wait, measured against its target on the working clock. */
export interface Wait {
  readonly thread: Thread;
  readonly kind: WaitKind;
  /**
   * The logins, or the team, the wait belongs to. It is empty when nobody
   * is assigned, which the views show as `unassigned`.
   */
  readonly owners: readonly string[];
  readonly started: Date;
  readonly target: Duration;
  /** When the target's working time has passed since `started`. */
  readonly due: Date;
  /** Whether the current time is past `due`. */
  readonly over: boolean;
}
