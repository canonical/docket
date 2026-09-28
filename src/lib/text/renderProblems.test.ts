import { describe, expect, it } from "vitest";
import renderProblems from "./renderProblems.js";
import type { Problem } from "./types.js";

const signedOut: Problem = {
  code: "GH_NOT_SIGNED_IN",
  message: "gh is not signed in to github.com.",
  recovery: "run gh auth login",
};
const duration: Problem = {
  code: "CONFIG_INVALID_DURATION",
  message: "`targets.close.issue` is `3x`, which is not a duration.",
  recovery: "Write a duration such as `24h`, `2d` or `1w`.",
};

describe("renderProblems", () => {
  it("gives an agent a heading with the code, the sentence and the recovery", () => {
    expect(renderProblems([signedOut], "llm")).toBe(
      "## Error: GH_NOT_SIGNED_IN\ngh is not signed in to github.com.\nRecovery: run gh auth login\n",
    );
  });

  it("gives a person each problem as a paragraph", () => {
    expect(renderProblems([signedOut, duration], "plain")).toBe(
      [
        "Error GH_NOT_SIGNED_IN",
        "gh is not signed in to github.com.",
        "Recovery: run gh auth login",
        "",
        "Error CONFIG_INVALID_DURATION",
        "`targets.close.issue` is `3x`, which is not a duration.",
        "Recovery: Write a duration such as `24h`, `2d` or `1w`.",
        "",
      ].join("\n"),
    );
  });

  it("gives a program every problem as JSON", () => {
    expect(JSON.parse(renderProblems([signedOut], "json"))).toEqual({
      errors: [signedOut],
    });
    expect(JSON.parse(renderProblems([signedOut], "json", "Warning"))).toEqual({
      warnings: [signedOut],
    });
  });

  it("prints no control sequence a message repeats from a file", () => {
    const hostile = {
      ...duration,
      message: "`\u001b]52;c;eA==\u0007x` is bad.",
    };
    expect(renderProblems([hostile], "plain")).toContain("`x` is bad.");
  });
});
