import { describe, expect, it } from "vitest";
import { alice, dave } from "../../testing/facts.js";
import { bot, comment, issueNode, user } from "../../testing/github.js";
import readIssue from "./readIssue.js";
import type { IssueNode } from "./types.js";

const read = (fields: Record<string, unknown> = {}) =>
  readIssue("example-org/example-repo", issueNode(fields) as IssueNode);

describe("readIssue", () => {
  it("reads an open issue's facts, with nothing a pull request adds", () => {
    expect(read()).toEqual({
      repo: "example-org/example-repo",
      number: 1,
      url: "https://github.com/example-org/example-repo/issues/1",
      kind: "issue",
      title: "Example issue",
      author: dave,
      createdAt: new Date("2026-09-22T08:00:00Z"),
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

  it("reads a closed issue as not open", () => {
    expect(read({ state: "CLOSED" }).open).toBe(false);
  });

  it("reads the labels, the assignees and each comment with its writer", () => {
    const issue = read({
      labels: { nodes: [{ name: "bug" }, { name: "Topic: roadmap" }] },
      assignees: { nodes: [user("alice"), bot("example-sync")] },
      comments: { nodes: [comment("alice", "2026-09-22T09:00:00Z")] },
    });
    expect(issue.labels).toEqual(["bug", "Topic: roadmap"]);
    expect(issue.assignees).toEqual([
      { login: "alice", type: "user" },
      { login: "example-sync", type: "bot" },
    ]);
    expect(issue.comments).toEqual([
      { author: alice, at: new Date("2026-09-22T09:00:00Z") },
    ]);
  });
});
