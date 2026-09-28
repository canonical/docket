import { describe, expect, it } from "vitest";
import {
  fakeProvider,
  fullBudget,
  providerError,
} from "../../testing/provider.js";
import CacheError from "./CacheError.js";
import classifyRefreshFailure from "./classifyRefreshFailure.js";

const budget = fakeProvider({ budget: async () => fullBudget });

describe("classifyRefreshFailure", () => {
  it("keeps a provider's error or the cache's own as it is", async () => {
    const offline = providerError("GITHUB_UNREACHABLE");
    const locked = new CacheError("CACHE_LOCK_TIMED_OUT", "Held.", "wait");
    expect(await classifyRefreshFailure(offline, budget)).toEqual({
      failure: offline,
    });
    expect(await classifyRefreshFailure(locked, budget)).toEqual({
      failure: locked,
    });
  });

  it.each([
    [
      new Error("The operation timed out."),
      "docket could not refresh its cache: The operation timed out.",
    ],
    ["no answer", "docket could not refresh its cache: no answer."],
    [new Error("Gone!"), "docket could not refresh its cache: Gone!"],
    [
      new Error("Bad credentials?"),
      "docket could not refresh its cache: Bad credentials?",
    ],
    [new Error(""), "docket could not refresh its cache."],
  ])(
    "names any other failure %s as one sentence, with a step that holds",
    async (thrown, message) => {
      expect(await classifyRefreshFailure(thrown, budget)).toEqual({
        failure: expect.objectContaining({
          code: "CACHE_REFRESH_FAILED",
          message,
          recovery: "refresh again",
        }),
      });
    },
  );

  it("pauses until the budget resets after a rate limit, or keeps the rate limit when the budget cannot be read", async () => {
    const limited = providerError("GITHUB_RATE_LIMITED");
    expect(await classifyRefreshFailure(limited, budget)).toEqual({
      paused: { until: fullBudget.resetAt, reason: "rateLimit" },
    });
    const unread = fakeProvider({ budget: () => Promise.reject(limited) });
    expect(await classifyRefreshFailure(limited, unread)).toEqual({
      failure: limited,
    });
  });
});
