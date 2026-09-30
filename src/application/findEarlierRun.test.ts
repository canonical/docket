import { describe, expect, it } from "vitest";
import type { CacheStatus } from "../lib/cache/index.js";
import { settleStatus } from "../testing/cache.js";
import { providerError } from "../testing/provider.js";
import { recordedNow } from "../testing/recorded.js";
import findEarlierRun from "./findEarlierRun.js";

const repo = "example-org/example-repo";
const timedOut = providerError("GITHUB_TIMED_OUT");
const failedOn = (error: typeof timedOut): CacheStatus => ({
  ...settleStatus(recordedNow),
  stages: [{ repo, stage: { kind: "failed", error } }],
});

describe("findEarlierRun", () => {
  it("finds the stages an earlier run's when the failure held is none a repository stopped on", () => {
    expect(
      findEarlierRun({
        ...failedOn(timedOut),
        failure: providerError("GITHUB_REQUEST_FAILED"),
      }),
    ).toBe(true);
  });

  it("finds them this run's when a repository stopped on the failure held, even as a copy of it", () => {
    const copy = Object.assign(new Error(timedOut.message), {
      code: timedOut.code,
      recovery: timedOut.recovery,
    });
    expect(findEarlierRun({ ...failedOn(timedOut), failure: copy })).toBe(
      false,
    );
  });

  it("finds them this run's with no failure, under a pause, or for the rate limit, which pauses the lines itself", () => {
    const status = failedOn(timedOut);
    const until = new Date("2026-09-28T13:00:00Z");
    expect(findEarlierRun(status)).toBe(false);
    expect(
      findEarlierRun({
        ...status,
        failure: providerError("GITHUB_UNREACHABLE"),
        paused: { until, reason: "rateLimit" },
      }),
    ).toBe(false);
    expect(
      findEarlierRun({
        ...status,
        failure: providerError("GITHUB_RATE_LIMITED"),
      }),
    ).toBe(false);
  });
});
