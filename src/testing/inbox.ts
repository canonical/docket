/**
 * Notifications as the provider reads them, for the inbox's view model
 * and its faces. It imports nothing from vitest.
 */
import type { InboxNotification } from "../lib/inbox/index.js";
import { at } from "./facts.js";

/** One notification, with the fields a test leaves out given defaults. */
export function notification(
  facts: Partial<InboxNotification> = {},
): InboxNotification {
  return {
    id: "1",
    repo: "example-org/example-repo",
    repoUrl: "https://github.com/example-org/example-repo",
    subject: {
      title: "Fix the parser",
      kind: "pullRequest",
      number: 12,
      url: "https://github.com/example-org/example-repo/pull/12",
    },
    reason: "review_requested",
    unread: true,
    updatedAt: at("2026-09-28T11:00+02:00"),
    ...facts,
  };
}

/** Unread, read, discussion and browser-only notifications from two repositories. */
export const recordedNotifications: readonly InboxNotification[] = [
  notification({
    id: "1",
    subject: {
      title: "Fix the parser",
      kind: "pullRequest",
      number: 12,
      url: "https://github.com/example-org/example-repo/pull/12",
    },
    reason: "review_requested",
    updatedAt: at("2026-09-28T11:00+02:00"),
  }),
  notification({
    id: "2",
    repo: "example-org/example-docs",
    repoUrl: "https://github.com/example-org/example-docs",
    subject: {
      title: "Where do tokens live?",
      kind: "issue",
      number: 4,
      url: "https://github.com/example-org/example-docs/issues/4",
    },
    reason: "mention",
    unread: true,
    updatedAt: at("2026-09-28T10:00+02:00"),
  }),
  notification({
    id: "3",
    subject: {
      title: "Crash on start",
      kind: "issue",
      number: 15,
      url: "https://github.com/example-org/example-repo/issues/15",
    },
    reason: "assign",
    unread: false,
    updatedAt: at("2026-09-27T10:00+02:00"),
  }),
  notification({
    id: "4",
    subject: {
      title: "Tokens page",
      kind: "discussion",
      number: 7,
      url: "https://github.com/example-org/example-repo/discussions/7",
    },
    reason: "team_mention",
    unread: true,
    updatedAt: at("2026-09-28T09:00+02:00"),
  }),
  notification({
    id: "5",
    subject: {
      title: "Update dependency example-lib to 2.0",
      kind: "release",
      url: "https://github.com/example-org/example-repo/releases",
    },
    reason: "subscribed",
    unread: true,
    updatedAt: at("2026-09-28T08:00+02:00"),
  }),
];
