import { describe, expect, it } from "vitest";
import { user } from "../../testing/github.js";
import readEnding from "./readEnding.js";

const at = "2026-09-24T14:00:00Z";
const docs = {
  number: 7,
  url: "https://github.com/example-org/example-docs/issues/7",
  repository: { nameWithOwner: "example-org/example-docs" },
};

describe("readEnding", () => {
  it("gives an open thread no ending", () => {
    expect(readEnding("issue", { state: "OPEN" }, undefined)).toBeUndefined();
    expect(
      readEnding("pullRequest", { state: "CLOSED", closedAt: null }, undefined),
    ).toBeUndefined();
  });

  it("reads a merge from the pull request's state, ended by whoever merged it", () => {
    const merged = { state: "MERGED", mergedAt: at, mergedBy: user("bob") };
    const close = { actor: user("alice") };
    expect(readEnding("pullRequest", merged, close)).toEqual({
      outcome: "merged",
      label: "merged",
      at: new Date(at),
      by: { login: "bob", type: "user" },
    });
  });

  it("reads a pull request closed without merging as closed, whatever reason its close records", () => {
    const closed = { state: "CLOSED", closedAt: at };
    expect(readEnding("pullRequest", closed, { actor: user("alice") })).toEqual(
      {
        outcome: "closed",
        label: "closed",
        at: new Date(at),
        by: { login: "alice", type: "user" },
      },
    );
  });

  it("reads an issue's reason for closing in GitHub's words", () => {
    const closed = (stateReason: string | null) => ({
      state: "CLOSED",
      stateReason,
      closedAt: at,
    });
    const labels = ["COMPLETED", "NOT_PLANNED", "DUPLICATE", null].map(
      (reason) => readEnding("issue", closed(reason), undefined)?.label,
    );
    expect(labels).toEqual([
      "closed as completed",
      "closed as not planned",
      "closed as duplicate",
      "closed",
    ]);
  });

  it("names nobody when the timeline holds no close", () => {
    const closed = { state: "CLOSED", stateReason: "COMPLETED", closedAt: at };
    expect(readEnding("issue", closed, undefined)).not.toHaveProperty("by");
  });

  it("names what closed the thread, and what it duplicates", () => {
    const closed = { state: "CLOSED", stateReason: "DUPLICATE", closedAt: at };
    const closers = [
      { __typename: "PullRequest" as const, ...docs },
      {
        __typename: "Commit" as const,
        oid: "c0ffee1",
        url: "https://github.com/example-org/example-docs/commit/c0ffee1",
      },
      { __typename: "ProjectV2" as const },
      null,
    ].map(
      (closer) =>
        readEnding("issue", closed, { actor: null, closer, duplicateOf: docs })
          ?.closer,
    );
    expect(closers).toEqual([
      {
        kind: "pullRequest",
        repo: "example-org/example-docs",
        number: 7,
        url: docs.url,
      },
      {
        kind: "commit",
        oid: "c0ffee1",
        url: "https://github.com/example-org/example-docs/commit/c0ffee1",
      },
      { kind: "project" },
      undefined,
    ]);
    expect(
      readEnding("issue", closed, { actor: null, duplicateOf: docs }),
    ).toMatchObject({
      by: { login: "ghost" },
      duplicateOf: {
        repo: "example-org/example-docs",
        number: 7,
        url: docs.url,
      },
    });
  });
});
