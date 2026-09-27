import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import {
  fakeGitHub,
  restUser,
  type Sent,
  settle,
  token,
} from "../../testing/github.js";
import createClient from "./createClient.js";
import setAssignees from "./setAssignees.js";

let github: ReturnType<typeof fakeGitHub>;
const route = "/repos/example-org/example-repo/issues/1";
const answer = (...logins: string[]) => ({
  body: { assignees: logins.map((login) => restUser(login)) },
});

beforeEach(() => {
  vi.useFakeTimers();
  github = fakeGitHub();
  vi.stubGlobal("fetch", github.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const assign = (...logins: string[]) =>
  settle(
    setAssignees(
      createClient(token, "1.2.3"),
      { ...thread(), kind: "issue" },
      logins,
    ),
  );
const writes = () =>
  github.sent
    .filter(({ method }) => method !== "GET")
    .map(({ method, body }: Sent) => [method, body?.assignees]);

describe("setAssignees", () => {
  it("removes whoever is not listed and adds whoever is missing, whatever the case", async () => {
    const times: number[] = [];
    github.rest(`GET ${route}`, answer("Alice", "bob", "carol"));
    github.rest(`DELETE ${route}/assignees`, () => {
      times.push(Date.now());
      return answer("Alice");
    });
    github.rest(`POST ${route}/assignees`, () => {
      times.push(Date.now());
      return answer("Alice", "dave");
    });
    expect(await assign("alice", "dave")).toEqual([
      { login: "Alice", type: "user" },
      { login: "dave", type: "user" },
    ]);
    expect(writes()).toEqual([
      ["DELETE", ["bob", "carol"]],
      ["POST", ["dave"]],
    ]);
    // Writes pass through the throttling plugin's queue, which spaces them
    // about a second apart.
    expect((times.at(1) ?? 0) - (times.at(0) ?? 0)).toBeGreaterThan(900);
  });

  it("writes nothing when the set is already the one asked for", async () => {
    github.rest(`GET ${route}`, answer("alice"));
    expect(await assign("ALICE")).toEqual([{ login: "alice", type: "user" }]);
    expect(writes()).toEqual([]);
  });

  it("only adds when nobody is removed, and gives what GitHub records", async () => {
    github.rest(`GET ${route}`, answer());
    github.rest(`POST ${route}/assignees`, answer("alice"));
    expect(await assign("alice", "nobody-assignable")).toEqual([
      { login: "alice", type: "user" },
    ]);
    expect(writes()).toEqual([["POST", ["alice", "nobody-assignable"]]]);
  });
});
