import { describe, expect, it } from "vitest";
import { thread } from "../../testing/facts.js";
import applyChecks from "./applyChecks.js";

const pull = (number: number, checks?: "passing" | "failing" | "running") =>
  thread({ number, kind: "pullRequest", ...(checks ? { checks } : {}) });

describe("applyChecks", () => {
  it("sets the checks read again on their pull request", () => {
    expect(
      applyChecks(
        [pull(1, "running"), pull(2, "running")],
        [{ repo: "example-org/example-repo", number: 2, checks: "failing" }],
      ),
    ).toEqual([pull(1, "running"), pull(2, "failing")]);
  });

  it("clears the checks of a pull request whose head commit has none", () => {
    expect(
      applyChecks(
        [pull(1, "running")],
        [{ repo: "example-org/example-repo", number: 1 }],
      ),
    ).toEqual([pull(1)]);
  });

  it("leaves an issue with a pull request's number alone", () => {
    expect(
      applyChecks(
        [thread({ number: 1 })],
        [{ repo: "example-org/example-repo", number: 1, checks: "passing" }],
      ),
    ).toEqual([thread({ number: 1 })]);
  });
});
