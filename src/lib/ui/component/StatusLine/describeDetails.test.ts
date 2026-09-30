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
    expect(describeDetails(settled, fresh, "active", count)).toBe(
      "details 3/12",
    );
    expect(describeDetails(settled, fresh, "waking", count)).toBe(
      "details 3/12",
    );
  });

  it("says nothing with nothing pending", () => {
    expect(describeDetails(settled, fresh, "active", undefined)).toBe("");
  });

  it("hides the count on an error, while the refresh is paused, while idle and while nothing is shown", () => {
    const error: StatusMessage = { kind: "error", text: "✗ offline" };
    const budget = { ...settled, paused: { until, reason: "budget" as const } };
    const firstRun = { ...settled, syncedAt: undefined };
    expect(describeDetails(settled, error, "active", count)).toBe("");
    expect(describeDetails(budget, fresh, "active", count)).toBe("");
    expect(describeDetails(settled, fresh, "idle", count)).toBe("");
    expect(describeDetails(firstRun, undefined, "active", count)).toBe("");
    expect(describeDetails(undefined, undefined, "active", count)).toBe("");
  });

  it("hides the count while the rate limit refused a request", () => {
    const refused = {
      ...settled,
      failure: Object.assign(new Error("limited"), {
        code: "GITHUB_RATE_LIMITED",
        recovery: "wait",
      } as const),
    };
    const pause: StatusMessage = { kind: "notice", text: "paused: rate limit" };
    expect(describeDetails(refused, pause, "active", count)).toBe("");
  });
});
