import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import { fakeGitHub, restUser, settle, token } from "../../testing/github.js";
import createClient from "./createClient.js";
import fetchAssignees from "./fetchAssignees.js";

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

describe("fetchAssignees", () => {
  it("gives the assignees GitHub records on the thread now", async () => {
    github.rest("GET /repos/example-org/example-repo/issues/1", {
      body: { assignees: [restUser("alice"), restUser("example-sync", "Bot")] },
    });
    const assignees = await settle(
      fetchAssignees(createClient(token, "github.com", "1.2.3"), {
        ...thread(),
        kind: "issue",
      }),
    );
    expect(assignees).toEqual([
      { login: "alice", type: "user" },
      { login: "example-sync", type: "bot" },
    ]);
  });
});
