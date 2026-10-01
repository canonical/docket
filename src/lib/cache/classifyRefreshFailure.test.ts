import { describe, expect, it } from "vitest";
import { fullBudget, providerError } from "../../testing/provider.js";
import CacheError from "./CacheError.js";
import classifyRefreshFailure from "./classifyRefreshFailure.js";

const budget = { graphql: fullBudget };

describe("classifyRefreshFailure", () => {
  it("keeps a provider's error or the cache's own as it is", () => {
    const offline = providerError("GITHUB_UNREACHABLE");
    const locked = new CacheError("CACHE_LOCK_TIMED_OUT", "Held.", "wait");
    expect(classifyRefreshFailure(offline, budget)).toEqual({
      failure: offline,
    });
    expect(classifyRefreshFailure(locked, budget)).toEqual({
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
    (thrown, message) => {
      expect(classifyRefreshFailure(thrown, budget)).toEqual({
        failure: expect.objectContaining({
          code: "CACHE_REFRESH_FAILED",
          message,
          recovery: "refresh again",
        }),
      });
    },
  );

  it("pauses until the queries' budget resets after a rate limit, or keeps the rate limit when no budget is known", () => {
    const limited = providerError("GITHUB_RATE_LIMITED");
    expect(classifyRefreshFailure(limited, budget)).toEqual({
      paused: { until: fullBudget.resetAt, reason: "rateLimit" },
    });
    expect(classifyRefreshFailure(limited, {})).toEqual({ failure: limited });
  });

  it("pauses until the budget spent to nothing resets, whichever kind it is", () => {
    const limited = providerError("GITHUB_RATE_LIMITED");
    const later = new Date("2026-09-28T11:30:00Z");
    const rest = { ...fullBudget, remaining: 0, resetAt: later };
    expect(classifyRefreshFailure(limited, { ...budget, rest })).toEqual({
      paused: { until: later, reason: "rateLimit" },
    });
  });
});
