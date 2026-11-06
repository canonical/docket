import { describe, expect, it } from "vitest";
import readNotification from "./readNotification.js";
import type { RestNotification } from "./types.js";

const raw = (facts: Partial<RestNotification> = {}): RestNotification => ({
  id: "1",
  unread: true,
  reason: "review_requested",
  updated_at: "2026-09-28T09:00:00Z",
  last_read_at: null,
  subject: {
    title: "Fix parser",
    url: "https://api.github.com/repos/example-org/example-repo/pulls/12",
    latest_comment_url:
      "https://api.github.com/repos/example-org/example-repo/issues/comments/9",
    type: "PullRequest",
  },
  repository: {
    full_name: "example-org/example-repo",
    html_url: "https://github.com/example-org/example-repo",
  },
  url: "https://api.github.com/notifications/threads/1",
  subscription_url:
    "https://api.github.com/notifications/threads/1/subscription",
  ...facts,
});

describe("readNotification", () => {
  it("reads a pull request's number and its page in a browser", () => {
    expect(readNotification(raw())).toMatchObject({
      id: "1",
      repo: "example-org/example-repo",
      repoUrl: "https://github.com/example-org/example-repo",
      subject: {
        title: "Fix parser",
        kind: "pullRequest",
        number: 12,
        url: "https://github.com/example-org/example-repo/pull/12",
      },
      reason: "review_requested",
      unread: true,
      updatedAt: new Date("2026-09-28T09:00:00Z"),
    });
  });

  it("reads an issue, a discussion and a commit, and keeps a last-read time", () => {
    const issue = readNotification(
      raw({
        subject: {
          ...raw().subject,
          type: "Issue",
          url: "https://api.github.com/repos/example-org/example-repo/issues/15",
        },
        last_read_at: "2026-09-28T08:00:00Z",
      }),
    );
    expect(issue.subject).toMatchObject({
      kind: "issue",
      number: 15,
      url: "https://github.com/example-org/example-repo/issues/15",
    });
    expect(issue.lastReadAt).toEqual(new Date("2026-09-28T08:00:00Z"));
    const discussion = readNotification(
      raw({
        subject: {
          ...raw().subject,
          type: "Discussion",
          url: "https://api.github.com/repos/example-org/example-repo/discussions/7",
        },
      }),
    );
    expect(discussion.subject).toMatchObject({
      kind: "discussion",
      number: 7,
      url: "https://github.com/example-org/example-repo/discussions/7",
    });
    const commit = readNotification(
      raw({
        subject: {
          ...raw().subject,
          type: "Commit",
          url: "https://api.github.com/repos/example-org/example-repo/commits/abc123",
        },
      }),
    );
    expect(commit.subject).toMatchObject({
      kind: "commit",
      url: "https://github.com/example-org/example-repo/commit/abc123",
    });
    expect(commit.subject.number).toBeUndefined();
  });

  it("falls back to the repository page for a subject docket cannot place", () => {
    expect(
      readNotification(
        raw({
          subject: {
            ...raw().subject,
            type: "SomethingNew",
            url: "https://api.github.com/repos/example-org/example-repo/something/1",
          },
        }),
      ).subject,
    ).toMatchObject({
      kind: "other",
      url: "https://github.com/example-org/example-repo",
    });
  });
});
