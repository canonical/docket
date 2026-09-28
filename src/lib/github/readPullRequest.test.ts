import { describe, expect, it } from "vitest";
import { alice, bob } from "../../testing/facts.js";
import { pullNode, user } from "../../testing/github.js";
import readPullRequest from "./readPullRequest.js";
import type { PullNode } from "./types.js";

const none = new Map<string, readonly string[]>();
const read = (
  fields: Record<string, unknown> = {},
  members: ReadonlyMap<string, readonly string[]> = none,
) =>
  readPullRequest(
    "example-org/example-repo",
    pullNode(fields) as PullNode,
    [],
    members,
  );
const head = (state: string | null) => ({
  nodes: [
    {
      commit: {
        committedDate: "2026-09-22T07:55:00Z",
        author: { user: { login: "alice" } },
        statusCheckRollup: state && { state },
      },
    },
  ],
});

describe("readPullRequest", () => {
  it("reads an open pull request, with no checks and no stack", () => {
    expect(read()).toEqual({
      repo: "example-org/example-repo",
      number: 2,
      url: "https://github.com/example-org/example-repo/pull/2",
      kind: "pullRequest",
      title: "Example pull request",
      author: alice,
      createdAt: new Date("2026-09-22T08:00:00Z"),
      updatedAt: new Date("2026-09-22T08:00:00Z"),
      open: true,
      draft: false,
      labels: [],
      assignees: [],
      comments: [],
      reviews: [],
      reviewRequests: [],
      pushes: [],
    });
  });

  it("reads a draft, and a merged pull request as not open", () => {
    expect(read({ isDraft: true }).draft).toBe(true);
    expect(read({ state: "MERGED" }).open).toBe(false);
  });

  it("keeps the pushes it is given", () => {
    const push = {
      author: { login: "alice", type: "user" } as const,
      at: new Date("2026-09-22T09:00:00Z"),
    };
    const pull = readPullRequest(
      "example-org/example-repo",
      pullNode() as PullNode,
      [push],
      none,
    );
    expect(pull.pushes).toEqual([push]);
  });

  it("reads each submitted review with its text and leaves a review still in draft out", () => {
    const pull = read({
      latestReviews: {
        nodes: [
          {
            author: user("bob"),
            authorAssociation: "MEMBER",
            submittedAt: "2026-09-22T10:00:00Z",
            bodyText: "Two nits.",
          },
          {
            author: user("carol"),
            authorAssociation: "MEMBER",
            submittedAt: null,
          },
        ],
      },
    });
    expect(pull.reviews).toEqual([
      { author: bob, at: new Date("2026-09-22T10:00:00Z"), text: "Two nits." },
    ]);
  });

  it("reads the requests standing once the withdrawals are applied, with who asked", () => {
    const team = { __typename: "Team", combinedSlug: "example-org/reviewers" };
    const pull = read(
      {
        requested: {
          nodes: [
            {
              __typename: "ReviewRequestedEvent",
              createdAt: "2026-09-22T09:00:00Z",
              requestedReviewer: user("bob"),
            },
            {
              __typename: "ReviewRequestedEvent",
              createdAt: "2026-09-22T09:00:00Z",
              requestedReviewer: team,
              actor: user("alice"),
            },
          ],
        },
        withdrawn: {
          nodes: [
            {
              __typename: "ReviewRequestRemovedEvent",
              createdAt: "2026-09-22T10:00:00Z",
              requestedReviewer: user("bob"),
            },
          ],
        },
      },
      new Map([["example-org/reviewers", ["carol"]]]),
    );
    expect(pull.reviewRequests).toEqual([
      {
        reviewer: { team: "example-org/reviewers", members: ["carol"] },
        at: new Date("2026-09-22T09:00:00Z"),
        requester: { login: "alice", type: "user" },
      },
    ]);
  });

  it("reads the checks on the head commit", () => {
    expect(read({ commits: head("FAILURE") }).checks).toBe("failing");
    expect(read({ commits: head(null) })).not.toHaveProperty("checks");
    expect(read({ commits: { nodes: [] } })).not.toHaveProperty("checks");
  });

  it("reads where it sits in its stack", () => {
    expect(
      read({
        stackEntry: {
          position: 1,
          stack: { number: 7, size: 2, baseRefName: "main" },
        },
      }).stack,
    ).toEqual({ number: 7, position: 1, size: 2, base: "main" });
  });
});
