import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import {
  comment,
  fakeGitHub,
  rateLimit,
  settle,
  token,
} from "../../testing/github.js";
import type { ThreadSummary } from "../waits/index.js";
import createClient from "./createClient.js";
import fetchThreadDetails from "./fetchThreadDetails.js";

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

const details = (threads: readonly ThreadSummary[]) =>
  settle(
    fetchThreadDetails(createClient(token, "github.com", "1.2.3"), threads),
  );
const node = (body: string) => ({
  createdAt: "2026-09-21T08:00:00Z",
  updatedAt: "2026-09-22T12:00:00Z",
  labels: { nodes: [] },
  assignees: { nodes: [] },
  comments: {
    nodes: [{ ...comment("dave", "2026-09-22T09:00:00Z"), body }],
  },
});

describe("fetchThreadDetails", () => {
  it("reads every thread's details in one query, in the order given, with nothing for a thread GitHub does not find", async () => {
    github.graphql("Details", {
      body: {
        data: {
          rateLimit,
          t0: { issue: node("On the issue.") },
          t1: { discussion: node("On the discussion.") },
          t2: { issue: null },
        },
        errors: [
          {
            type: "NOT_FOUND",
            path: ["t2", "issue"],
            message: "Could not resolve to an Issue with the number of 9.",
          },
        ],
      },
    });
    const found = await details([
      thread(),
      {
        ...thread(),
        repo: "example-org/example-docs",
        number: 4,
        kind: "discussion",
      },
      { ...thread(), number: 9 },
    ]);
    expect(github.sent).toHaveLength(1);
    const query = String(github.sent.at(0)?.body?.query);
    expect(query).toContain(
      't1: repository(owner: "example-org", name: "example-docs") { discussion(number: 4) {',
    );
    expect(query).toContain("t2: repository");
    expect(found.map((each) => each?.messages.at(0)?.body)).toEqual([
      "On the issue.",
      "On the discussion.",
      undefined,
    ]);
  });

  it("asks GitHub nothing when no thread is given", async () => {
    expect(await details([])).toEqual([]);
    expect(github.sent).toHaveLength(0);
  });
});
