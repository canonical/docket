import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import {
  bot,
  comment,
  fakeGitHub,
  repository,
  settle,
  token,
  user,
} from "../../testing/github.js";
import type { ThreadSummary } from "../waits/index.js";
import createClient from "./createClient.js";
import fetchThreadDetail from "./fetchThreadDetail.js";

let github: ReturnType<typeof fakeGitHub>;

beforeEach(() => {
  vi.useFakeTimers();
  github = fakeGitHub();
  vi.stubGlobal("fetch", github.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const detail = (summary: ThreadSummary) =>
  settle(
    fetchThreadDetail(createClient(token, "github.com", "1.2.3"), summary),
  );
const message = (login: string, at: string, body: string) => ({
  ...comment(login, at),
  body,
});

describe("fetchThreadDetail", () => {
  it("gives an issue's age, labels, assignees and latest comments with their text", async () => {
    github.graphql(
      "Detail",
      repository({
        issue: {
          createdAt: "2026-09-21T08:00:00Z",
          updatedAt: "2026-09-22T12:00:00Z",
          labels: { nodes: [{ name: "kind: bug" }, { name: "area/icons" }] },
          assignees: { nodes: [user("alice"), bot("example-sync")] },
          comments: {
            nodes: [message("dave", "2026-09-22T09:00:00Z", "Any news?")],
          },
        },
      }),
    );
    expect(await detail(thread())).toEqual({
      createdAt: new Date("2026-09-21T08:00:00Z"),
      updatedAt: new Date("2026-09-22T12:00:00Z"),
      labels: ["kind: bug", "area/icons"],
      assignees: [
        { login: "alice", type: "user" },
        { login: "example-sync", type: "bot" },
      ],
      messages: [
        {
          author: { login: "dave", type: "user", member: true },
          at: new Date("2026-09-22T09:00:00Z"),
          body: "Any news?",
        },
      ],
      requests: [],
      files: [],
      checks: [],
    });
    expect(github.sent.at(0)?.body?.variables).toEqual({
      owner: "example-org",
      name: "example-repo",
      number: 1,
      issue: true,
      pull: false,
      discussion: false,
    });
  });

  it("gives a pull request's reviews, requesters, files, checks and stack", async () => {
    github.graphql(
      "Detail",
      repository({
        pullRequest: {
          createdAt: "2026-09-21T08:00:00Z",
          updatedAt: "2026-09-22T12:00:00Z",
          labels: { nodes: [] },
          assignees: { nodes: [] },
          comments: {
            nodes: [message("bob", "2026-09-22T11:00:00Z", "Rebased.")],
          },
          reviews: {
            nodes: [
              {
                ...message("carol", "", "Looks good."),
                submittedAt: "2026-09-22T10:00:00Z",
              },
              { ...message("bob", "", "Draft note"), submittedAt: null },
            ],
          },
          timelineItems: {
            nodes: [
              {
                createdAt: "2026-09-22T09:00:00Z",
                actor: user("alice"),
                requestedReviewer: {
                  __typename: "Team",
                  combinedSlug: "example-org/reviewers",
                },
              },
              {
                createdAt: "2026-09-22T09:01:00Z",
                actor: bot("example-sync"),
                requestedReviewer: { __typename: "User", login: "bob" },
              },
              {
                createdAt: "2026-09-22T09:02:00Z",
                actor: user("alice"),
                requestedReviewer: null,
              },
            ],
          },
          files: {
            nodes: [{ path: "src/index.ts", additions: 12, deletions: 3 }],
          },
          commits: {
            nodes: [
              {
                commit: {
                  statusCheckRollup: {
                    contexts: {
                      nodes: [
                        {
                          __typename: "CheckRun",
                          name: "lint",
                          status: "COMPLETED",
                          conclusion: "FAILURE",
                          completedAt: "2026-09-22T09:05:00Z",
                          checkSuite: { app: { slug: "example-ci" } },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          },
          stack: {
            entries: {
              nodes: [
                { position: 1, pullRequest: { number: 1, state: "MERGED" } },
                { position: 2, pullRequest: { number: 2, state: "OPEN" } },
              ],
            },
          },
        },
      }),
    );
    const found = await detail({ ...thread(), number: 2, kind: "pullRequest" });
    expect(found.messages.map(({ body }) => body)).toEqual([
      "Looks good.",
      "Rebased.",
    ]);
    expect(found.requests).toEqual([
      {
        reviewer: { team: "example-org/reviewers" },
        requester: { login: "alice", type: "user" },
        at: new Date("2026-09-22T09:00:00Z"),
      },
      {
        reviewer: { login: "bob", type: "user" },
        requester: { login: "example-sync", type: "bot" },
        at: new Date("2026-09-22T09:01:00Z"),
      },
    ]);
    expect(found.files).toEqual([
      { path: "src/index.ts", additions: 12, deletions: 3 },
    ]);
    expect(found.checks).toEqual([{ name: "lint", state: "failing" }]);
    expect(found.stack).toEqual([
      { position: 1, number: 1, state: "merged" },
      { position: 2, number: 2, state: "open" },
    ]);
  });

  it("gives no checks and no stack to a pull request without them", async () => {
    github.graphql(
      "Detail",
      repository({
        pullRequest: {
          createdAt: "2026-09-21T08:00:00Z",
          updatedAt: "2026-09-22T12:00:00Z",
          labels: { nodes: [] },
          assignees: { nodes: [] },
          comments: { nodes: [] },
          reviews: { nodes: [] },
          timelineItems: { nodes: [] },
          files: null,
          commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
          stack: null,
        },
      }),
    );
    const found = await detail({ ...thread(), kind: "pullRequest" });
    expect(found).toMatchObject({ files: [], checks: [] });
    expect(found).not.toHaveProperty("stack");
  });

  it("asks for a discussion by its kind, which has labels and no assignees", async () => {
    github.graphql(
      "Detail",
      repository({
        discussion: {
          createdAt: "2026-09-21T08:00:00Z",
          updatedAt: "2026-09-22T12:00:00Z",
          labels: { nodes: [{ name: "question" }] },
          comments: { nodes: [] },
        },
      }),
    );
    expect(await detail({ ...thread(), kind: "discussion" })).toMatchObject({
      createdAt: new Date("2026-09-21T08:00:00Z"),
      labels: ["question"],
      assignees: [],
    });
    expect(github.sent.at(0)?.body?.variables).toMatchObject({
      discussion: true,
      issue: false,
    });
  });

  it("names GITHUB_REQUEST_FAILED when the answer holds no thread", async () => {
    github.graphql("Detail", repository({ issue: null }));
    await expect(detail(thread())).rejects.toMatchObject({
      code: "GITHUB_REQUEST_FAILED",
      message: "GitHub has no thread 1 in example-org/example-repo.",
    });
  });
});
