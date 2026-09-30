/**
 * Details of the threads in `rows.ts`, as a provider reads them, and
 * readings that never arrive or fail, for the accordion's stories and
 * tests. It imports nothing from vitest.
 */

import type { ProviderError, ThreadDetail } from "../lib/provider/index.js";
import { alice, at, bob, dave } from "./facts.js";

/**
 * The details of `overReview`: alice asked bob on Friday morning, one
 * file of two has lines removed, lint fails, and the stack's first pull
 * request is merged.
 */
export const overReviewDetail: ThreadDetail = {
  createdAt: at("2026-09-22T10:00+02:00"),
  updatedAt: at("2026-09-28T11:35+02:00"),
  labels: [],
  assignees: [],
  messages: [],
  requests: [
    { reviewer: bob, requester: alice, at: at("2026-09-25T09:00+02:00") },
  ],
  files: [
    { path: "src/parser.ts", additions: 40, deletions: 12 },
    { path: "src/parser.test.ts", additions: 25, deletions: 0 },
  ],
  checks: [
    { name: "lint", state: "failing" },
    { name: "test", state: "passing" },
  ],
  stack: [
    { position: 1, number: 11, state: "merged" },
    { position: 2, number: 12, state: "open" },
    { position: 3, number: 13, state: "open" },
  ],
};

/** The details of `soonReply`: dave's message of Sunday, unanswered. */
export const soonReplyDetail: ThreadDetail = {
  createdAt: at("2026-09-22T10:00+02:00"),
  updatedAt: at("2026-09-27T12:00+02:00"),
  labels: [],
  assignees: [],
  messages: [
    {
      author: dave,
      at: at("2026-09-27T12:00+02:00"),
      body: "It crashes as soon as it starts,\nbefore the first frame is drawn.",
    },
  ],
  requests: [],
  files: [],
  checks: [],
};

/** The details of `sharedClose`: bob spoke last, three hours ago. */
export const sharedCloseDetail: ThreadDetail = {
  createdAt: at("2026-09-22T10:00+02:00"),
  updatedAt: at("2026-09-28T09:00+02:00"),
  labels: ["priority: high", "kind=bug", "area/icons"],
  assignees: [alice, bob, { login: "carol-at-example-org", type: "user" }],
  messages: [
    { author: bob, at: at("2026-09-28T09:00+02:00"), body: "Still open." },
  ],
  requests: [],
  files: [],
  checks: [],
};

/** A reading of details that never arrives. */
export const pendingDetail: Promise<ThreadDetail> = new Promise(() => {});

/**
 * A reading of details that fails with `error`. Its failure is marked as
 * handled at once, so a story that is never drawn leaves no unhandled
 * rejection behind.
 */
export function failDetail(error: unknown): Promise<ThreadDetail> {
  const failed = Promise.reject(error);
  failed.catch(() => {});
  return failed;
}

/**
 * `detail` as the snapshot holds it while reading is paused: marked
 * partial, its messages without their text, and none of what only a read
 * gives.
 */
export function pauseDetail(
  detail: ThreadDetail,
): ThreadDetail & { readonly partial: true } {
  return {
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    labels: detail.labels,
    assignees: detail.assignees,
    messages: detail.messages.map((message) => ({ ...message, body: "" })),
    requests: [],
    files: [],
    checks: [],
    partial: true,
  };
}

/**
 * GitHub's failure when it gives no answer in time, in the words and with
 * the recovery the GitHub provider gives it.
 */
export const timedOut: ProviderError = Object.assign(
  new Error("GitHub gave no answer within 30 seconds."),
  {
    code: "GITHUB_TIMED_OUT" as const,
    recovery:
      "check the network connection and https://www.githubstatus.com, then refresh",
    step: "check the network connection and https://www.githubstatus.com",
  },
);
