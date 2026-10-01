import { describe, expect, it } from "vitest";
import describeStackPlace from "./describeStackPlace.js";

describe("describeStackPlace", () => {
  it("names the stack and how many pull requests it holds, one or more", () => {
    expect(describeStackPlace({ number: 3, size: 3 })).toBe(
      "stack 3 · 3 PRs → ",
    );
    expect(describeStackPlace({ number: 7, size: 1 })).toBe(
      "stack 7 · 1 PR → ",
    );
  });
});
