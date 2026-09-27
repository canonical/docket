import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fakeGitHub,
  page,
  repository,
  settle,
  token,
} from "../../testing/github.js";
import createClient from "./createClient.js";
import listAssignableUsers from "./listAssignableUsers.js";

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

const assignable = (nodes: unknown[], next: string | null = null) =>
  repository({ assignableUsers: page(nodes, next) });
const list = () =>
  settle(
    listAssignableUsers(
      createClient(token, "github.com", "1.2.3"),
      "example-org/example-repo",
    ),
  );

describe("listAssignableUsers", () => {
  it("lists everyone assignable as a person, page after page", async () => {
    github.graphql(
      "Assignable",
      assignable([{ login: "alice" }], "a1"),
      assignable([{ login: "bob" }]),
    );
    expect(await list()).toEqual([
      { login: "alice", type: "user" },
      { login: "bob", type: "user" },
    ]);
    expect(github.sent.map(({ body }) => body?.variables)).toEqual([
      { owner: "example-org", name: "example-repo", after: null },
      { owner: "example-org", name: "example-repo", after: "a1" },
    ]);
  });

  it("lists nobody in a repository with no one assignable", async () => {
    github.graphql("Assignable", assignable([]));
    expect(await list()).toEqual([]);
  });
});
