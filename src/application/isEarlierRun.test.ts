import { describe, expect, it } from "vitest";
import type { CacheStatus } from "../lib/cache/index.js";
import { settleStatus } from "../testing/cache.js";
import { providerError } from "../testing/provider.js";
import { recordedNow } from "../testing/recorded.js";
import isEarlierRun from "./isEarlierRun.js";

const repo = "example-org/example-repo";
const timedOut = providerError("GITHUB_TIMED_OUT");
const buildFailedStatus = (error: typeof timedOut): CacheStatus => ({
  ...settleStatus(recordedNow),
  stages: [{ repo, stage: { kind: "failed", error } }],
});

describe("isEarlierRun", () => {
  it("judges the stages an earlier run's when the failure held is none a repository stopped on", () => {
    expect(
      isEarlierRun({
        ...buildFailedStatus(timedOut),
        failure: providerError("GITHUB_REQUEST_FAILED"),
      }),
    ).toBe(true);
  });

  it("judges the stages an earlier run's when the failure held has a stage's code but another message and step", () => {
    const refusedBefore = Object.assign(new Error("GitHub refused the list."), {
      code: "GITHUB_REQUEST_FAILED",
      recovery: "check gh's access",
    } as const);
    const refusedNow = Object.assign(new Error("GitHub refused the query."), {
      code: "GITHUB_REQUEST_FAILED",
      recovery: "report it",
    } as const);
    expect(
      isEarlierRun({
        ...buildFailedStatus(refusedBefore),
        failure: refusedNow,
      }),
    ).toBe(true);
  });

  it("judges them this run's when a repository stopped on the failure held, even as a copy of it", () => {
    const copy = Object.assign(new Error(timedOut.message), {
      code: timedOut.code,
      recovery: timedOut.recovery,
    });
    expect(
      isEarlierRun({ ...buildFailedStatus(timedOut), failure: copy }),
    ).toBe(false);
  });

  it("judges them this run's with no failure, under a pause, or for the rate limit, which pauses the lines itself", () => {
    const status = buildFailedStatus(timedOut);
    const until = new Date("2026-09-28T13:00:00Z");
    expect(isEarlierRun(status)).toBe(false);
    expect(
      isEarlierRun({
        ...status,
        failure: providerError("GITHUB_UNREACHABLE"),
        paused: { until, reason: "rateLimit" },
      }),
    ).toBe(false);
    expect(
      isEarlierRun({
        ...status,
        failure: providerError("GITHUB_RATE_LIMITED"),
      }),
    ).toBe(false);
  });
});
