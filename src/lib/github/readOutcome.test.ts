import { describe, expect, it } from "vitest";
import readOutcome from "./readOutcome.js";

describe("readOutcome", () => {
  it("reads an issue's reason for closing", () => {
    expect(readOutcome("issue", "COMPLETED")).toBe("completed");
    expect(readOutcome("issue", "NOT_PLANNED")).toBe("notPlanned");
    expect(readOutcome("issue", "DUPLICATE")).toBe("duplicate");
  });

  it("reads an issue closed with no reason, or one it does not know, as closed", () => {
    expect(readOutcome("issue", null)).toBe("closed");
    expect(readOutcome("issue", undefined)).toBe("closed");
    expect(readOutcome("issue", "REOPENED")).toBe("closed");
  });

  it("reads every close of a pull request as closed, whatever reason GitHub records", () => {
    expect(readOutcome("pullRequest", "COMPLETED")).toBe("closed");
  });
});
