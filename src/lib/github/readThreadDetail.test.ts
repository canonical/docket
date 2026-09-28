import { describe, expect, it } from "vitest";
import { comment, user } from "../../testing/github.js";
import readThreadDetail from "./readThreadDetail.js";

describe("readThreadDetail", () => {
  it("gives the messages oldest first, leaving out a review not yet submitted", () => {
    const found = readThreadDetail({
      createdAt: "2026-09-21T08:00:00Z",
      updatedAt: "2026-09-22T12:00:00Z",
      labels: { nodes: [{ name: "kind: bug" }] },
      assignees: { nodes: [user("alice")] },
      comments: {
        nodes: [{ ...comment("bob", "2026-09-22T11:00:00Z"), body: "Later." }],
      },
      reviews: {
        nodes: [
          {
            ...comment("carol", ""),
            body: "Earlier.",
            submittedAt: "2026-09-22T10:00:00Z",
          },
          { ...comment("carol", ""), body: "Unsent.", submittedAt: null },
        ],
      },
    });
    expect(found.messages.map(({ body }) => body)).toEqual([
      "Earlier.",
      "Later.",
    ]);
    expect(found).toMatchObject({
      labels: ["kind: bug"],
      assignees: [{ login: "alice", type: "user" }],
      requests: [],
      files: [],
      checks: [],
    });
  });

  it("gives a stack's members by position, number and state", () => {
    const found = readThreadDetail({
      createdAt: "2026-09-21T08:00:00Z",
      updatedAt: "2026-09-22T12:00:00Z",
      labels: { nodes: [] },
      comments: { nodes: [] },
      stack: {
        entries: {
          nodes: [{ position: 1, pullRequest: { number: 3, state: "MERGED" } }],
        },
      },
    });
    expect(found.stack).toEqual([{ position: 1, number: 3, state: "merged" }]);
    expect(found.assignees).toEqual([]);
  });
});
