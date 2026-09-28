import { describe, expect, it } from "vitest";
import readChecks from "./readChecks.js";

describe("readChecks", () => {
  it("reads success as passing", () => {
    expect(readChecks("SUCCESS")).toBe("passing");
  });

  it("reads a failure or an error as failing", () => {
    expect(readChecks("FAILURE")).toBe("failing");
    expect(readChecks("ERROR")).toBe("failing");
  });

  it("reads pending or expected checks as running", () => {
    expect(readChecks("PENDING")).toBe("running");
    expect(readChecks("EXPECTED")).toBe("running");
  });

  it("gives nothing when no check ran or the state is unknown", () => {
    expect(readChecks(null)).toBeUndefined();
    expect(readChecks(undefined)).toBeUndefined();
    expect(readChecks("")).toBeUndefined();
    expect(readChecks("SKIPPED")).toBeUndefined();
  });
});
