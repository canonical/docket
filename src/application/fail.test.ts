import { describe, expect, it } from "vitest";
import fail from "./fail.js";

describe("fail", () => {
  it("throws an error carrying its code, its sentence and its recovery", () => {
    expect(() =>
      fail("THREAD_NOT_FOUND", "No open thread.", "run docket owed"),
    ).toThrow(
      expect.objectContaining({
        code: "THREAD_NOT_FOUND",
        message: "No open thread.",
        recovery: "run docket owed",
      }),
    );
  });
});
