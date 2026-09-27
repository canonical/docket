import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import {
  fakeGitHub,
  page,
  rateLimit,
  repository,
  settle,
  token,
} from "../../testing/github.js";
import createProvider from "./createProvider.js";

type Callback = (error: unknown, stdout: string, stderr: string) => void;

const gh = vi.hoisted(() => ({ error: null as unknown, stdout: "" }));
vi.mock("node:child_process", () => ({
  execFile: (_file: string, _args: string[], done: Callback) =>
    done(gh.error, gh.stdout, ""),
}));

let github: ReturnType<typeof fakeGitHub>;
const repo = "example-org/example-repo";
const pull = { ...thread(), number: 2, kind: "pullRequest" as const };

beforeEach(() => {
  vi.useFakeTimers();
  gh.error = null;
  gh.stdout = `${token}\n`;
  github = fakeGitHub();
  vi.stubGlobal("fetch", github.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const empty = {
  issues: page([]),
  pullRequests: page([]),
  discussions: page([]),
};

describe("createProvider", () => {
  it("stops with GH_NOT_INSTALLED when gh is missing", async () => {
    gh.error = Object.assign(new Error("spawn gh ENOENT"), { code: "ENOENT" });
    await expect(createProvider("1.2.3")).rejects.toMatchObject({
      code: "GH_NOT_INSTALLED",
    });
  });

  it("declares every optional fact GitHub supplies", async () => {
    const provider = await createProvider("1.2.3");
    expect([...provider.capabilities()].sort()).toEqual([
      "botAccounts",
      "changeProbe",
      "checks",
      "discussions",
      "pushes",
      "stacks",
      "teamReviews",
    ]);
  });

  it("asks for the budget once, then reads it from the latest answer", async () => {
    const provider = await createProvider("1.2.3");
    github.graphql("Budget", { body: { data: { rateLimit } } });
    const expected = {
      limit: 5000,
      remaining: 4990,
      resetAt: new Date("2026-09-28T11:00:00Z"),
    };
    expect(await settle(provider.budget())).toEqual(expected);
    github.graphql("Snapshot", repository(empty));
    await settle(provider.snapshot(repo, null));
    expect(await settle(provider.budget())).toEqual(expected);
    expect(github.sent).toHaveLength(2);
  });

  it("sends each operation to GitHub with the token gh gave", async () => {
    const provider = await createProvider("1.2.3");
    const feed = `GET /repos/${repo}/activity`;
    github.graphql("Snapshot", repository(empty));
    github.graphql("Checks", { body: { data: { rateLimit, r0: {} } } });
    github.graphql("Events", repository(empty));
    github.rest(feed, { body: [] });
    github.graphql(
      "Detail",
      repository({
        issue: { updatedAt: "2026-09-22T12:00:00Z", comments: { nodes: [] } },
      }),
    );
    const assignable = repository({ assignableUsers: page([]) });
    github.graphql("Assignable", assignable, assignable);
    github.graphql("Candidates", repository({ pullRequest: null }));
    github.rest(`GET /repos/${repo}/teams`, { body: [] });
    github.rest(`GET /repos/${repo}/issues/1`, { body: { assignees: [] } });
    github.rest(`GET /repos/${repo}/pulls/2/requested_reviewers`, {
      body: { users: [], teams: [] },
    });
    github.graphql("TeamMembers", {
      body: { data: { organization: null } },
    });
    github.rest(`GET /repos/${repo}/issues`, { status: 304 });
    await settle(
      Promise.all([
        provider.snapshot(repo, null),
        provider.refreshVolatile([pull]),
        provider.events(repo, new Date("2026-09-22T00:00:00Z")),
        provider.threadDetail(thread()),
        provider.assignableUsers(repo),
        provider.reviewCandidates(pull),
        provider.setAssignees({ ...thread(), kind: "issue" }, []),
        provider.setReviewers(pull, []),
        provider.teamMembers("example-org/reviewers"),
        provider.probe(repo, 'W/"one"'),
      ]),
    );
    expect(github.sent).toHaveLength(13);
    for (const sent of github.sent) {
      expect(sent.headers.get("authorization")).toBe(`token ${token}`);
    }
  });
});
