import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import { fakeGitHub, rateLimit, settle, token } from "../../testing/github.js";
import createClient from "./createClient.js";
import refreshChecks from "./refreshChecks.js";

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

const pull = (state: string | null) => ({
  commits: {
    nodes: [{ commit: { statusCheckRollup: state && { state } } }],
  },
});
const refresh = (pulls: Parameters<typeof refreshChecks>[1]) =>
  settle(refreshChecks(createClient(token, "1.2.3"), pulls));

describe("refreshChecks", () => {
  it("reads the checks of every pull request given in one query", async () => {
    github.graphql("Checks", {
      body: {
        data: {
          rateLimit,
          r0: { p2: pull("SUCCESS"), p3: pull("PENDING"), p4: null },
          r1: { p2: pull(null) },
        },
      },
    });
    const docs = { ...thread(), repo: "example-org/example-docs" };
    const checks = await refresh([
      { ...thread(), number: 2 },
      { ...thread(), number: 3 },
      { ...thread(), number: 4 },
      { ...docs, number: 2 },
    ]);
    expect(github.sent).toHaveLength(1);
    expect(String(github.sent.at(0)?.body?.query)).toContain(
      'r1: repository(owner: "example-org", name: "example-docs") { p2: pullRequest(number: 2)',
    );
    expect(checks).toEqual([
      { repo: "example-org/example-repo", number: 2, checks: "passing" },
      { repo: "example-org/example-repo", number: 3, checks: "running" },
      { repo: "example-org/example-docs", number: 2 },
    ]);
  });

  it("asks GitHub nothing when no pull request is given", async () => {
    expect(await refresh([])).toEqual([]);
    expect(github.sent).toHaveLength(0);
  });
});
