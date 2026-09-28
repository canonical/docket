import { describe, expect, it } from "vitest";
import { user } from "../../testing/github.js";
import readCheck from "./readCheck.js";

const run = (fields: Record<string, unknown>) => ({
  __typename: "CheckRun" as const,
  name: "lint",
  status: "COMPLETED",
  conclusion: "SUCCESS",
  completedAt: "2026-09-22T10:00:00Z",
  checkSuite: { app: { slug: "example-ci" } },
  ...fields,
});
const status = (state: string) => ({
  __typename: "StatusContext" as const,
  context: "deploy",
  state,
  createdAt: "2026-09-22T11:00:00Z",
  creator: user("alice"),
});

describe("readCheck", () => {
  it("reads a check run by its status and conclusion, run by its app", () => {
    expect(readCheck(run({}))).toEqual({
      name: "lint",
      state: "passing",
      at: new Date("2026-09-22T10:00:00Z"),
      actor: { login: "example-ci", type: "bot" },
    });
    expect(
      [
        run({ conclusion: "SKIPPED" }),
        run({ conclusion: "FAILURE" }),
        run({ conclusion: null }),
        run({ status: "IN_PROGRESS", completedAt: null }),
      ].map((node) => [readCheck(node).state, readCheck(node).at]),
    ).toEqual([
      ["passing", new Date("2026-09-22T10:00:00Z")],
      ["failing", new Date("2026-09-22T10:00:00Z")],
      ["failing", new Date("2026-09-22T10:00:00Z")],
      ["running", undefined],
    ]);
  });

  it("reads a check run whose app is gone as run by ghost", () => {
    expect(readCheck(run({ checkSuite: { app: null } })).actor).toEqual({
      login: "ghost",
      type: "user",
    });
  });

  it("reads a commit status by its state, set by its creator", () => {
    expect(
      ["SUCCESS", "PENDING", "EXPECTED", "FAILURE", "ERROR"].map(
        (state) => readCheck(status(state)).state,
      ),
    ).toEqual(["passing", "running", "running", "failing", "failing"]);
    expect(readCheck(status("SUCCESS"))).toMatchObject({
      name: "deploy",
      at: new Date("2026-09-22T11:00:00Z"),
      actor: { login: "alice", type: "user" },
    });
  });
});
