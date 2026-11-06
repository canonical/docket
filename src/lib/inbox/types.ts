import type { Repo } from "../config/index.js";
import type { Field, FieldList } from "../owed/index.js";

/** The kind of subject a notification names. */
export type InboxSubjectKind =
  | "issue"
  | "pullRequest"
  | "discussion"
  | "commit"
  | "release"
  | "security"
  | "invitation"
  | "other";

/** Whether the list shows only unread notifications or the whole inbox. */
export type InboxFilter = "unread" | "all";

/** How the inbox splits its list into sections. */
export type InboxGrouping = "repo" | "reason" | "type" | "none";

/**
 * One GitHub notification, as the provider reads it. Its subject is either
 * a thread docket knows (`issue`, `pullRequest`, `discussion`) or another
 * kind, which docket shows but sends to the browser for its details.
 */
export interface InboxNotification {
  /** GitHub's notification thread id. */
  readonly id: string;
  /** `owner/name` of the repository. */
  readonly repo: string;
  /** The repository's page on GitHub. */
  readonly repoUrl: string;
  readonly subject: {
    readonly title: string;
    readonly kind: InboxSubjectKind;
    /** The thread number, when the subject is a thread. */
    readonly number?: number;
    /** Where the subject is read in a browser. */
    readonly url: string;
  };
  /** GitHub's reason for the notification, such as `review_requested`. */
  readonly reason: string;
  readonly unread: boolean;
  readonly updatedAt: Date;
  readonly lastReadAt?: Date;
}

/** One notification as the list shows it. */
export interface InboxRow {
  readonly notification: InboxNotification;
  /** The repository's short name, or `owner/name` when it is not watched. */
  readonly repo: string;
  /** `example#12`, or `example commit` for a subject that is not a thread. */
  readonly reference: Field;
  readonly subjectKind: InboxSubjectKind;
  /** `issue`, `PR`, `discussion`, `commit`, `release`, `security`, `other`. */
  readonly kind: Field;
  /** Why GitHub notified, or `browser only` for a subject docket cannot detail. */
  readonly reason: Field;
  /** The age of the latest update, such as `25m`. */
  readonly distance: Field;
  readonly title: Field;
  readonly unread: boolean;
  readonly url: string;
}

/** A section of the inbox; without a heading when it is not grouped. */
export interface InboxGroup {
  readonly heading?: Field;
  readonly rows: readonly InboxRow[];
}

/** How many notifications stand in each state. */
export interface InboxCounts {
  readonly unread: number;
  readonly read: number;
}

/** Where the reader is in the inbox: its grouping and its filter. */
export interface InboxAddress {
  readonly mode: "inbox";
  readonly grouping: InboxGrouping;
  readonly filter: InboxFilter;
}

/** Everything the inbox shows for one address. */
export interface InboxList {
  readonly address: InboxAddress;
  readonly groups: readonly InboxGroup[];
  readonly counts: InboxCounts;
  /** `3 unread`, or `3 unread · 9 read` when the whole inbox shows. */
  readonly summary: FieldList;
}

/** The repositories the inbox names, for their short names. */
export type InboxRepos = readonly Repo[];
