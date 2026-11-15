import type {
  InboxNotification,
  InboxSubjectKind,
  InboxWorkflow,
} from "../inbox/index.js";
import readWorkflow from "./readWorkflow.js";
import type { RestNotification } from "./types.js";

const kinds: Readonly<Record<string, InboxSubjectKind>> = {
  Issue: "issue",
  PullRequest: "pullRequest",
  Discussion: "discussion",
  Commit: "commit",
  CheckSuite: "workflow",
  WorkflowRun: "workflow",
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
  workflow: undefined,
  release: "releases",
  security: "security",
  invitation: undefined,
  other: undefined,
};

/** The Actions page filtered to a workflow and branch, or the repository's Actions. */
const actionsPage = (repoUrl: string, workflow: InboxWorkflow | undefined) =>
  workflow
    ? `${repoUrl}/actions?${new URLSearchParams({ query: `branch:${workflow.branch} workflow:"${workflow.name}"` })}`
    : `${repoUrl}/actions`;

/**
 * Reads one REST notification: its subject's kind and number, the address
 * of its page in a browser, why GitHub notified, and when it last changed.
 * A workflow notification opens the Actions runs of its branch, and any
 * other subject docket cannot place falls back to its repository's page.
 */
export default function readNotification(
  notification: RestNotification,
): InboxNotification {
  const kind = kinds[notification.subject.type] ?? "other";
  const workflow = readWorkflow(notification.subject.title);
  const match = notification.subject.url
    ? /\/repos\/[^/]+\/[^/]+\/(?:issues|pulls|discussions|commits|releases)\/([^/?#]+)$/.exec(
        notification.subject.url,
      )
    : null;
  const id = match?.[1];
  const number =
    id === undefined ||
    (kind !== "issue" && kind !== "pullRequest" && kind !== "discussion")
      ? undefined
      : Number(id);
  const repoUrl = notification.repository.html_url.replace(/\/$/, "");
  const page = pages[kind];
  const url =
    kind === "workflow" || notification.reason === "ci_activity"
      ? actionsPage(repoUrl, workflow)
      : id === undefined || page === undefined
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
    ...(workflow && { workflow }),
    unread: notification.unread,
    updatedAt: new Date(notification.updated_at),
    ...(notification.last_read_at
      ? { lastReadAt: new Date(notification.last_read_at) }
      : {}),
  };
}
