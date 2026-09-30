import { describe, expect, it } from "vitest";
import type { CacheStatus } from "../../../cache/index.js";
import describeDetails from "./describeDetails.js";
import type { StatusMessage } from "./types.js";

const settled: CacheStatus = {
  syncedAt: new Date("2026-09-28T11:58:00Z"),
  refreshing: false,
  whole: false,
  stages: [],
  fullRefreshAvailableAt: undefined,
  paused: undefined,
  failure: undefined,
};
const fresh: StatusMessage = { kind: "freshness", text: "synced 2m ago" };
const count = { read: 3, asked: 12 };
const until = new Date("2026-09-28T13:00:00Z");

describe("describeDetails", () => {
  it("counts the details read of those asked for", () => {
    expect(describeDetails(settled, fresh, "active", false, count)).toBe(
      "details 3/12",
    );
    expect(describeDetails(settled, fresh, "waking", false, count)).toBe(
      "details 3/12",
    );
  });

  it("says nothing with nothing pending", () => {
    expect(describeDetails(settled, fresh, "active", false, undefined)).toBe(
      "",
    );
  });

  it("hides the count on an error, while the refresh is paused, while idle and while nothing is shown", () => {
    const error: StatusMessage = { kind: "error", text: "✗ offline" };
    const budget = { ...settled, paused: { until, reason: "budget" as const } };
    const firstRun = { ...settled, syncedAt: undefined };
    expect(describeDetails(settled, error, "active", false, count)).toBe("");
    expect(describeDetails(budget, fresh, "active", false, count)).toBe("");
    expect(describeDetails(settled, fresh, "idle", false, count)).toBe("");
    expect(describeDetails(firstRun, undefined, "active", false, count)).toBe(
      "",
    );
    expect(describeDetails(undefined, undefined, "active", false, count)).toBe(
      "",
    );
  });

  it("says details paused once their budget is spent, before any count, unless nothing is read, as under the rate limit", () => {
    const limited = {
      ...settled,
      paused: { until, reason: "rateLimit" as const },
    };
    expect(describeDetails(settled, fresh, "active", true, count)).toBe(
      "details paused",
    );
    expect(describeDetails(limited, undefined, "active", true, count)).toBe("");
    const refused = {
      ...settled,
      failure: Object.assign(new Error("limited"), {
        code: "GITHUB_RATE_LIMITED",
        recovery: "wait",
      } as const),
    };
    const pause: StatusMessage = { kind: "notice", text: "paused: rate limit" };
    expect(describeDetails(refused, pause, "active", true, count)).toBe("");
    expect(describeDetails(refused, pause, "active", false, count)).toBe("");
  });
});
