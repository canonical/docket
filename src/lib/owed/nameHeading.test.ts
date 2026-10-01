import { describe, expect, it } from "vitest";
import nameHeading from "./nameHeading.js";

describe("nameHeading", () => {
  it("words a stack's heading from its parts", () => {
    expect(
      nameHeading({
        kind: "stack",
        repo: "example",
        number: 3,
        size: 3,
        base: "main",
      }),
    ).toBe("example stack 3 · 3 PRs → main");
  });

  it("gives any other heading's own text", () => {
    expect(nameHeading({ text: "NOT IN A STACK", kind: "words" })).toBe(
      "NOT IN A STACK",
    );
  });
});
