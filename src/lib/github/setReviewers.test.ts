import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import { fakeGitHub, restUser, settle, token } from "../../testing/github.js";
import createClient from "./createClient.js";
import setReviewers from "./setReviewers.js";

let github: ReturnType<typeof fakeGitHub>;
const route = "/repos/example-org/example-repo/pulls/2/requested_reviewers";

beforeEach(() => {
  vi.useFakeTimers();
  github = fakeGitHub();
  vi.stubGlobal("fetch", github.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const request = (...reviewers: string[]) =>
  settle(
    setReviewers(
      createClient(token, "github.com", "1.2.3"),
      { ...thread(), number: 2, kind: "pullRequest" },
      reviewers,
    ),
  );
const standing = (users: string[], teams: string[]) => ({
  body: {
    users: users.map((login) => restUser(login)),
    teams: teams.map((slug) => ({ slug })),
  },
});
const pull = (users: string[], teams: string[]) => ({
  body: {
    requested_reviewers: users.map((login) => restUser(login)),
    requested_teams: teams.map((slug) => ({ slug })),
  },
});
const writes = () =>
  github.sent
    .filter(({ method }) => method !== "GET")
    .map(({ method, body }) => [method, body?.reviewers, body?.team_reviewers]);

describe("setReviewers", () => {
  it("withdraws the requests not listed and makes the missing ones", async () => {
    github.rest(`GET ${route}`, standing(["bob", "carol"], ["design"]));
    github.rest(`DELETE ${route}`, pull(["bob"], []));
    github.rest(`POST ${route}`, pull(["bob", "dave"], ["reviewers"]));
    expect(await request("BOB", "dave", "example-org/reviewers")).toEqual([
      { login: "bob", type: "user" },
      { login: "dave", type: "user" },
      { team: "example-org/reviewers" },
    ]);
    expect(writes()).toEqual([
      ["DELETE", ["carol"], ["design"]],
      ["POST", ["dave"], ["reviewers"]],
    ]);
  });

  it("only withdraws when nothing is missing", async () => {
    github.rest(`GET ${route}`, standing(["bob"], ["design"]));
    github.rest(`DELETE ${route}`, pull([], ["design"]));
    expect(await request("example-org/design")).toEqual([
      { team: "example-org/design" },
    ]);
    expect(writes()).toEqual([["DELETE", ["bob"], []]]);
  });

  it("withdraws a team alone", async () => {
    github.rest(`GET ${route}`, standing([], ["design"]));
    github.rest(`DELETE ${route}`, pull([], []));
    expect(await request()).toEqual([]);
    expect(writes()).toEqual([["DELETE", [], ["design"]]]);
  });

  it("writes nothing when the requests are already the ones asked for", async () => {
    github.rest(`GET ${route}`, standing(["bob"], []));
    expect(await request("bob")).toEqual([{ login: "bob", type: "user" }]);
    expect(writes()).toEqual([]);
  });
});
