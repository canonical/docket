import { describeAge } from "../activity/index.js";
import type { Repo } from "../config/index.js";
import { browserOnlyWord, inboxSubjectWords } from "./constants.js";
import describeReason from "./describeReason.js";
import type { InboxNotification, InboxRow } from "./types.js";

/** The repository's short name, or `owner/name` when it is not watched. */
const nameOf = (repo: string, repos: readonly Repo[]) =>
  repos.find(({ repo: full }) => full === repo)?.name ?? repo;

/** Whether docket can show the subject as a thread, with a number and details. */
const isThread = (notification: InboxNotification) =>
  notification.subject.kind === "issue" ||
  notification.subject.kind === "pullRequest" ||
  notification.subject.kind === "discussion";

/**
 * Builds the row for one notification: its kind's mark and reference, why
 * GitHub notified (or `browser only` for a subject docket cannot detail),
 * the age of its latest update, and its title.
 */
export default function buildRow(
  notification: InboxNotification,
  repos: readonly Repo[],
  now: Date,
): InboxRow {
  const repo = nameOf(notification.repo, repos);
  const { subject, reason } = notification;
  const reference = isThread(notification)
    ? `${repo}#${subject.number}`
    : `${repo} ${inboxSubjectWords[subject.kind]}`;
  return {
    notification,
    repo,
    reference: { text: reference, kind: "identifier" },
    subjectKind: subject.kind,
    kind: { text: inboxSubjectWords[subject.kind], kind: "words" },
    reason: {
      text: isThread(notification) ? describeReason(reason) : browserOnlyWord,
      kind: "words",
    },
    distance: {
      text: describeAge(notification.updatedAt, now),
      kind: "figure",
    },
    title: { text: subject.title, kind: "title" },
    unread: notification.unread,
    url: subject.url,
  };
}
