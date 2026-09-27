import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeGitHub, feedEntry, settle, token } from "../../testing/github.js";
import createClient from "./createClient.js";
import fetchPushes from "./fetchPushes.js";

let github: ReturnType<typeof fakeGitHub>;
const feed = "/repos/example-org/example-repo/activity";

beforeEach(() => {
  vi.useFakeTimers();
  github = fakeGitHub();
  vi.stubGlobal("fetch", github.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchPushes", () => {
  it("lists the pushes to every branch since an instant, with no more pages", async () => {
    github.rest(`GET ${feed}`, {
      body: [
        feedEntry({ ref: "refs/heads/main", after: "0000009" }),
        feedEntry({ activity_type: "pr_merge" }),
        feedEntry({ actor: null }),
      ],
    });
    const pushes = await settle(
      fetchPushes(
        createClient(token, "1.2.3"),
        "example-org/example-repo",
        new Date("2026-09-22T00:00:00Z"),
      ),
    );
    expect(github.sent.map(({ url }) => url.search)).toEqual(["?per_page=100"]);
    expect(pushes).toEqual([
      {
        ref: "refs/heads/main",
        before: "0000001",
        after: "0000009",
        at: new Date("2026-09-22T09:00:00Z"),
        actor: { login: "alice", type: "User" },
      },
      {
        ref: "refs/heads/feat/example",
        before: "0000001",
        after: "0000002",
        at: new Date("2026-09-22T09:00:00Z"),
        actor: null,
      },
    ]);
  });
});
