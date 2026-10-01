import { describe, expect, it } from "vitest";
import type { CacheStatus } from "../../../cache/index.js";
import describeRight from "./describeRight.js";
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

describe("describeRight", () => {
  it("counts the details read of those asked for", () => {
    expect(describeRight(settled, fresh, "active", count, "")).toBe(
      "details 3/12",
    );
    expect(describeRight(settled, fresh, "waking", count, "")).toBe(
      "details 3/12",
    );
  });

  it("says nothing with nothing pending", () => {
    expect(describeRight(settled, fresh, "active", undefined, "")).toBe("");
  });

  it("hides the count on an error, while the refresh is paused, while idle and while nothing is shown", () => {
    const error: StatusMessage = { kind: "error", text: "✗ offline" };
    const budget = { ...settled, paused: { until, reason: "budget" as const } };
    const firstRun = { ...settled, syncedAt: undefined };
    expect(describeRight(settled, error, "active", count, "")).toBe("");
    expect(describeRight(budget, fresh, "active", count, "")).toBe("");
    expect(describeRight(settled, fresh, "idle", count, "")).toBe("");
    expect(describeRight(firstRun, undefined, "active", count, "")).toBe("");
    expect(describeRight(undefined, undefined, "active", count, "")).toBe("");
  });

  it("says the budget's words with no details pending, and the count over them when both apply", () => {
    const live = "budget 35% · resets 14:20";
    expect(describeRight(settled, fresh, "active", undefined, live)).toBe(live);
    expect(describeRight(settled, fresh, "active", count, live)).toBe(
      "details 3/12",
    );
  });

  it("hides the budget's words on an error, at the floor, while idle and while nothing is shown", () => {
    const live = "budget 35% · resets 14:20";
    const error: StatusMessage = { kind: "error", text: "✗ offline" };
    const floor = { ...settled, paused: { until, reason: "budget" as const } };
    expect(describeRight(settled, error, "active", undefined, live)).toBe("");
    expect(describeRight(floor, fresh, "active", undefined, live)).toBe("");
    expect(describeRight(settled, fresh, "idle", undefined, live)).toBe("");
  });

  it("says neither while the rate limit refused a request", () => {
    const refused = {
      ...settled,
      failure: Object.assign(new Error("limited"), {
        code: "GITHUB_RATE_LIMITED",
        recovery: "wait",
      } as const),
    };
    const pause: StatusMessage = { kind: "notice", text: "paused: rate limit" };
    const live = "budget 35% · resets 14:20";
    expect(describeRight(refused, pause, "active", count, live)).toBe("");
    expect(describeRight(refused, pause, "active", undefined, live)).toBe("");
  });
});
