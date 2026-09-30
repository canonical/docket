import { describe, expect, it } from "vitest";
import { providerError } from "../../testing/provider.js";
import CacheError from "./CacheError.js";
import nameRefreshFailure from "./nameRefreshFailure.js";

describe("nameRefreshFailure", () => {
  it("keeps a provider's error or the cache's own as it is", () => {
    const limited = providerError("GITHUB_RATE_LIMITED");
    const locked = new CacheError("CACHE_LOCK_TIMED_OUT", "Held.", "wait");
    expect(nameRefreshFailure(limited)).toBe(limited);
    expect(nameRefreshFailure(locked)).toBe(locked);
  });

  it("names any other failure as a failed refresh, in one sentence, with a step that holds", () => {
    expect(nameRefreshFailure(new Error("no answer"))).toMatchObject({
      code: "CACHE_REFRESH_FAILED",
      message: "docket could not refresh its cache: no answer.",
      recovery: "refresh again",
    });
    expect(nameRefreshFailure("Gone!").message).toBe(
      "docket could not refresh its cache: Gone!",
    );
    expect(nameRefreshFailure(new Error("")).message).toBe(
      "docket could not refresh its cache.",
    );
  });
});
