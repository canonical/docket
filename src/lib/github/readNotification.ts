import type { InboxNotification, InboxSubjectKind } from "../inbox/index.js";
import type { RestNotification } from "./types.js";

const kinds: Readonly<Record<string, InboxSubjectKind>> = {
  Issue: "issue",
  PullRequest: "pullRequest",
  Discussion: "discussion",
  Commit: "commit",
  Release: "release",
  RepositoryVulnerabilityAlert: "security",
  RepositoryInvitation: "invitation",
};

/** The path GitHub's HTML page for a subject uses, after the repository. */
const pages: Readonly<Record<InboxSubjectKind, string | undefined>> = {
  issue: "issues",
  pullRequest: "pull",
  discussion: "discussions",
  commit: "commit",
  release: "releases",
  security: "security",
  invitation: undefined,
  other: undefined,
};

/**
 * Reads one REST notification: its subject's kind and number, the address
 * of its page in a browser, why GitHub notified, and when it last changed.
 * A subject docket cannot place falls back to its repository's page.
 */
export default function readNotification(
  notification: RestNotification,
): InboxNotification {
  const kind = kinds[notification.subject.type] ?? "other";
  const match =
    /\/repos\/[^/]+\/[^/]+\/(?:issues|pulls|discussions|commits|releases)\/([^/?#]+)$/.exec(
      notification.subject.url,
    );
  const id = match?.[1];
  const number =
    id === undefined ||
    (kind !== "issue" && kind !== "pullRequest" && kind !== "discussion")
      ? undefined
      : Number(id);
  const repoUrl = notification.repository.html_url.replace(/\/$/, "");
  const page = pages[kind];
  const url =
    id === undefined || page === undefined
      ? repoUrl
      : `${repoUrl}/${page}/${id}`;
  return {
    id: notification.id,
    repo: notification.repository.full_name,
    repoUrl,
    subject: {
      title: notification.subject.title,
      kind,
      ...(number !== undefined && Number.isFinite(number) ? { number } : {}),
      url,
    },
    reason: notification.reason,
    unread: notification.unread,
    updatedAt: new Date(notification.updated_at),
    ...(notification.last_read_at
      ? { lastReadAt: new Date(notification.last_read_at) }
      : {}),
  };
}
