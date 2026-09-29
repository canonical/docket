import { describe, expect, it } from "vitest";
import { settleStatus } from "../testing/cache.js";
import { at } from "../testing/facts.js";
import { providerError } from "../testing/provider.js";
import describeHold from "./describeHold.js";

const now = at("2026-09-28T12:00+02:00");
const until = at("2026-09-28T13:00+02:00");
const settled = settleStatus(now);
const failure = providerError("GITHUB_TIMED_OUT");

describe("describeHold", () => {
  it("holds nothing while a refresh runs, or when none has stopped", () => {
    expect(describeHold(settled, "Europe/Paris")).toBeUndefined();
    const running = { ...settled, refreshing: true, failure };
    expect(describeHold(running, "Europe/Paris")).toBeUndefined();
  });

  it("names a rate limit first, with the time docket resumes", () => {
    const limited = {
      ...settled,
      paused: { until, reason: "rateLimit" as const },
      failure,
    };
    expect(describeHold(limited, "Europe/Paris")).toEqual({
      reason: "GitHub refused requests for its rate limit",
      recovery: "wait: docket resumes at 13:00",
    });
  });

  it("names what stopped the last refresh, with its recovery", () => {
    const stopped = {
      ...settled,
      paused: { until, reason: "budget" as const },
      failure,
    };
    expect(describeHold(stopped, "Europe/Paris")).toEqual({
      reason: failure.message,
      recovery: failure.recovery,
    });
  });

  it("names a pause to spare the budget, in the time zone given", () => {
    const paused = { ...settled, paused: { until, reason: "budget" as const } };
    expect(describeHold(paused, "UTC")).toEqual({
      reason: "docket paused the refresh to spare the request budget",
      recovery: "wait: docket resumes at 11:00",
    });
  });
});
