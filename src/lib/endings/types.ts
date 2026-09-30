import type { Duration } from "../clock/index.js";
import type { Account, Author } from "../people/index.js";
import type { ThreadSummary } from "../waits/index.js";

/**
 * How a thread ended, as a concept no provider owns: merged; closed with
 * no reason recorded; or closed as completed, as not planned, or as a
 * duplicate. Each provider maps its own states onto these, and a pull
 * request closed without merging is `closed`, never `notPlanned`.
 */
export type Outcome =
  | "merged"
  | "closed"
  | "completed"
  | "notPlanned"
  | "duplicate";

/** A thread another names, such as the one a duplicate repeats. */
export type ThreadAddress = Pick<ThreadSummary, "repo" | "number" | "url">;

/** What closed a thread, where the provider records it. */
export type Closer =
  | ({ readonly kind: "pullRequest" } & ThreadAddress)
  | { readonly kind: "commit"; readonly oid: string; readonly url: string }
  /**
   * A project, unnamed: a provider may keep a project's name from a reader
   * allowed to see the thread.
   */
  | { readonly kind: "project" };

/** How and when a thread ended, and who ended it. */
export interface Ending {
  readonly outcome: Outcome;
  /**
   * The ending in the provider's own words, such as `closed as not
   * planned`: shown as the provider's text is, and never reasoned on.
   */
  readonly label: string;
  /** When the thread was merged or closed. */
  readonly at: Date;
  /** Who merged or closed it, where the provider records someone. */
  readonly by?: Account;
  readonly closer?: Closer;
  /** The thread it repeats, when it was closed as a duplicate of one. */
  readonly duplicateOf?: ThreadAddress;
}

/** A thread that was merged or closed, and is still so. */
export interface FinishedThread extends ThreadSummary {
  /** Who opened it, and whether the provider marks them a member. */
  readonly author: Author;
  /** When it was opened. */
  readonly createdAt: Date;
  readonly draft: boolean;
  readonly labels: readonly string[];
  readonly assignees: readonly Account[];
  readonly ending: Ending;
}

/**
 * The measures of a finished thread: time to close, time to first reply
 * and time to first review, each a wait read at its end.
 */
export type MeasureKind = "close" | "firstResponse" | "firstReview";

/**
 * How a measure reads: measured; pending, while the data does not hold
 * its facts yet; not applicable to the thread; or unsupported, when the
 * provider cannot supply its facts. Only a measured one enters a figure.
 */
export type MeasureState =
  | "measured"
  | "pending"
  | "notApplicable"
  | "unsupported";

/** Whether a measured wait ended past its target or within it. */
export type Verdict = "over" | "within";

/** One measure of a finished thread. */
export type Measure =
  | {
      readonly kind: MeasureKind;
      readonly state: Exclude<MeasureState, "measured">;
    }
  | {
      readonly kind: MeasureKind;
      readonly state: "measured";
      /** When the wait started. */
      readonly started: Date;
      /** When it ended. */
      readonly ended: Date;
      /** The working time from its start to its end, in milliseconds. */
      readonly workingTime: number;
      /** The target in effect. */
      readonly target: Duration;
      /**
       * The working time past the target as a share of it, negative
       * within it.
       */
      readonly overdue: number;
      readonly verdict: Verdict;
    };

/** The three measures of a finished thread, by kind. */
export type Measures = { readonly [Kind in MeasureKind]: Measure };

/** What a list holds of one measure: how it reads across the list, and its coverage. */
export interface Coverage {
  readonly state: MeasureState;
  /** How many threads it is measured on. */
  readonly of: number;
  /** How many threads it is still pending on. */
  readonly pending: number;
}

/** A finished thread and the last instant its ending is inside a window. */
export interface TimedEnding {
  readonly thread: FinishedThread;
  /** Adding the window to the ending: it is inside the window until then. */
  readonly until: Date;
}
