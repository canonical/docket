import { describe, expect, it } from "vitest";
import readStackEntry from "./readStackEntry.js";

describe("readStackEntry", () => {
  it("reads where a pull request sits in its stack", () => {
    expect(
      readStackEntry({
        position: 2,
        stack: { number: 7, size: 3, baseRefName: "main" },
      }),
    ).toEqual({ number: 7, position: 2, size: 3, base: "main" });
  });

  it("gives nothing for a pull request outside a stack", () => {
    expect(readStackEntry(null)).toBeUndefined();
  });
});
