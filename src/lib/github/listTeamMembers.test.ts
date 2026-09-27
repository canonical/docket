import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeGitHub, page, settle, token } from "../../testing/github.js";
import createClient from "./createClient.js";
import listTeamMembers from "./listTeamMembers.js";

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

const team = (members: unknown) => ({
  body: { data: { organization: { team: members && { members } } } },
});
const list = () =>
  settle(
    listTeamMembers(
      createClient(token, "github.com", "1.2.3"),
      "example-org/reviewers",
    ),
  );

describe("listTeamMembers", () => {
  it("lists every member, page after page", async () => {
    github.graphql(
      "TeamMembers",
      team(page([{ login: "alice" }], "m1")),
      team(page([{ login: "bob" }])),
    );
    expect(await list()).toEqual(["alice", "bob"]);
    expect(github.sent.map(({ body }) => body?.variables)).toEqual([
      { organisation: "example-org", team: "reviewers", after: null },
      { organisation: "example-org", team: "reviewers", after: "m1" },
    ]);
  });

  it("lists nobody for a team GitHub does not show", async () => {
    github.graphql("TeamMembers", team(null));
    expect(await list()).toEqual([]);
  });
});
