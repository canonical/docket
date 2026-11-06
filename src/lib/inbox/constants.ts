import type { InboxGrouping, InboxSubjectKind } from "./types.js";

/** The groupings, in the order the reader steps through them; the first is the default. */
export const inboxGroupings: readonly InboxGrouping[] = [
  "repo",
  "reason",
  "type",
  "none",
];

/** The kinds of subject, in the order the `type` sections come. */
export const inboxSubjectKinds: readonly InboxSubjectKind[] = [
  "issue",
  "pullRequest",
  "discussion",
  "commit",
  "release",
  "security",
  "invitation",
  "other",
];

/** The word each kind of subject goes by on a row. */
export const inboxSubjectWords: Readonly<Record<InboxSubjectKind, string>> = {
  issue: "issue",
  pullRequest: "PR",
  discussion: "discussion",
  commit: "commit",
  release: "release",
  security: "security",
  invitation: "invitation",
  other: "other",
};

/**
 * Why GitHub notified, in the order the `reason` sections come: the ones
 * that ask for an action first, then the rest, and `other` last.
 */
export const inboxReasonOrder: readonly string[] = [
  "review_requested",
  "mention",
  "team_mention",
  "assign",
  "comment",
  "author",
  "ci_activity",
  "state_change",
  "security_alert",
  "invitation",
  "manual",
  "subscribed",
  "other",
];

/** The label a subject docket cannot detail carries. */
export const browserOnlyWord = "browser only";
