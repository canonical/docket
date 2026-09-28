import { describe, expect, it } from "vitest";
import identifyThread from "./identifyThread.js";

describe("identifyThread", () => {
  it("names a thread by its repository and number", () => {
    expect(
      identifyThread({ repo: "example-org/example-repo", number: 12 }),
    ).toBe("example-org/example-repo#12");
  });
});
