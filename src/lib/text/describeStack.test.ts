import { describe, expect, it } from "vitest";
import describeStack from "./describeStack.js";

describe("describeStack", () => {
  it("names the stack with GitHub's word and the pull request's place in it", () => {
    expect(
      describeStack("example", {
        number: 12,
        position: 2,
        size: 5,
        base: "main",
      }),
    ).toBe("example stack 12, 2 of 5");
  });
});
