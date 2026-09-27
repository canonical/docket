import { describe, expect, it } from "vitest";
import CacheError from "./CacheError.js";

describe("CacheError", () => {
  it("carries its code, its message and its recovery step", () => {
    const error = new CacheError(
      "CACHE_LOCK_TIMED_OUT",
      "Another docket kept the cache locked.",
      "wait a moment, then refresh",
    );
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "CacheError",
      code: "CACHE_LOCK_TIMED_OUT",
      message: "Another docket kept the cache locked.",
      recovery: "wait a moment, then refresh",
    });
  });

  it("names itself in its text", () => {
    const error = new CacheError("CACHE_REFRESH_FAILED", "No answer.", "retry");
    expect(String(error)).toBe("CacheError: No answer.");
  });
});
