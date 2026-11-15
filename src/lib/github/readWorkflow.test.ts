import { describe, expect, it } from "vitest";
import readWorkflow from "./readWorkflow.js";

describe("readWorkflow", () => {
  it.each([
    [
      "CI workflow run failed for main branch",
      { name: "CI", branch: "main", failed: true },
    ],
    [
      "React frontend workflow run succeeded for feature/x branch",
      { name: "React frontend", branch: "feature/x", failed: false },
    ],
    [
      "Release workflow run timed out for v1 branch",
      { name: "Release", branch: "v1", failed: true },
    ],
  ])("reads the workflow and branch from %s", (title, expected) => {
    expect(readWorkflow(title)).toEqual(expected);
  });

  it("reads nothing from a title that names no workflow run", () => {
    expect(readWorkflow("Fix the parser")).toBeUndefined();
  });
});
