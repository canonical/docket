import { describe, expect, it } from "vitest";
import { user } from "../../testing/github.js";
import type { ThreadSummary } from "../waits/index.js";
import readFinished from "./readFinished.js";
import type { FinishedNode } from "./types.js";

const since = new Date("2026-09-22T00:00:00Z");
const issue: ThreadSummary = {
  repo: "example-org/example-repo",
  number: 1,
  url: "https://github.com/example-org/example-repo/issues/1",
  kind: "issue",
  title: "Example",
};

const node = (fields: Partial<FinishedNode> = {}): FinishedNode => ({
  state: "CLOSED",
  stateReason: "COMPLETED",
  closedAt: "2026-09-23T10:00:00Z",
  createdAt: "2026-09-21T08:00:00Z",
  author: user("dave"),
  authorAssociation: "NONE",
  labels: { nodes: [{ name: "kind=bug" }] },
  assignees: { nodes: [user("alice")] },
  timelineItems: { nodes: [] },
  ...fields,
});

const closed = (login: string) => ({
  __typename: "ClosedEvent",
  actor: user(login),
});

describe("readFinished", () => {
  it("reads a thread closed in the window with its facts and its ending", () => {
    expect(readFinished(issue, node(), since)).toEqual({
      ...issue,
      author: { login: "dave", type: "user", member: false },
      createdAt: new Date("2026-09-21T08:00:00Z"),
      draft: false,
      labels: ["kind=bug"],
      assignees: [{ login: "alice", type: "user" }],
      ending: {
        outcome: "completed",
        label: "closed as completed",
        at: new Date("2026-09-23T10:00:00Z"),
      },
    });
  });

  it("marks an author the organisation counts as a member, whether or not they wrote an open thread", () => {
    const member = node({ author: user("erin"), authorAssociation: "MEMBER" });
    expect(readFinished(issue, member, since)?.author).toEqual({
      login: "erin",
      type: "user",
      member: true,
    });
  });

  it("ends a thread closed twice with its latest close, and names who made it", () => {
    const twice = node({
      timelineItems: {
        nodes: [
          closed("bob"),
          { __typename: "ReopenedEvent" },
          closed("alice"),
        ],
      },
    });
    expect(readFinished(issue, twice, since)?.ending.by?.login).toBe("alice");
  });

  it("marks a draft pull request as a draft", () => {
    const pull = { ...issue, kind: "pullRequest" as const };
    expect(readFinished(pull, node({ isDraft: true }), since)?.draft).toBe(
      true,
    );
  });

  it("leaves out a thread open now, and one that ended before the window, keeping one that ended as it starts", () => {
    expect(readFinished(issue, node({ state: "OPEN" }), since)).toBeUndefined();
    const atStart = node({ closedAt: since.toISOString() });
    expect(readFinished(issue, atStart, since)?.ending.at).toEqual(since);
    const earlier = node({ closedAt: "2026-09-21T23:59:59Z" });
    expect(readFinished(issue, earlier, since)).toBeUndefined();
  });
});
