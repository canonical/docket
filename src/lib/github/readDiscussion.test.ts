import { describe, expect, it } from "vitest";
import { alice, bob, dave } from "../../testing/facts.js";
import { comment, discussionNode } from "../../testing/github.js";
import readDiscussion from "./readDiscussion.js";
import type { DiscussionNode } from "./types.js";

const read = (fields: Record<string, unknown> = {}) =>
  readDiscussion(
    "example-org/example-repo",
    discussionNode(fields) as DiscussionNode,
  );

describe("readDiscussion", () => {
  it("reads an open discussion's facts, with nothing a pull request adds", () => {
    expect(read({ updatedAt: "2026-09-24T08:00:00Z" })).toEqual({
      repo: "example-org/example-repo",
      number: 3,
      url: "https://github.com/example-org/example-repo/discussions/3",
      kind: "discussion",
      title: "Example discussion",
      author: dave,
      createdAt: new Date("2026-09-22T08:00:00Z"),
      updatedAt: new Date("2026-09-24T08:00:00Z"),
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

  it("reads a closed discussion as not open, and reads its labels", () => {
    const discussion = read({
      closed: true,
      labels: { nodes: [{ name: "announcement" }] },
    });
    expect(discussion.open).toBe(false);
    expect(discussion.labels).toEqual(["announcement"]);
  });

  it("reads each reply as a message, right after the comment it answers", () => {
    const discussion = read({
      comments: {
        nodes: [
          {
            ...comment("alice", "2026-09-22T09:00:00Z"),
            replies: {
              nodes: [comment("dave", "2026-09-22T10:00:00Z", "NONE")],
            },
          },
          {
            ...comment("bob", "2026-09-22T11:00:00Z"),
            replies: { nodes: [] },
          },
        ],
      },
    });
    expect(discussion.comments).toEqual([
      { author: alice, at: new Date("2026-09-22T09:00:00Z") },
      { author: dave, at: new Date("2026-09-22T10:00:00Z") },
      { author: bob, at: new Date("2026-09-22T11:00:00Z") },
    ]);
  });
});
