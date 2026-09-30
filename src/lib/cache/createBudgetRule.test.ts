import { describe, expect, it } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import createBudgetRule from "./createBudgetRule.js";
import type { CacheStatus } from "./types.js";

const clock = new Date("2026-09-28T10:00:00Z");
const settled: CacheStatus = {
  syncedAt: clock,
  refreshing: false,
  whole: false,
  stages: [],
  fullRefreshAvailableAt: undefined,
  paused: undefined,
  failure: undefined,
};
const low = { graphql: { ...fullBudget, remaining: 900 } };

/** The rule over `figures`, with the status changes it gives out. */
const judge = (figures = low, status = settled) => {
  const told: Partial<CacheStatus>[] = [];
  const rule = createBudgetRule({
    figures: () => figures,
    now: () => clock,
    status: () => status,
    publish: (change) => told.push(change),
  });
  return { rule, told };
};

describe("createBudgetRule", () => {
  it("judges the floor on the mirror, until its reset", () => {
    expect(judge().rule.judgeFloor()).toEqual({
      until: fullBudget.resetAt,
      reason: "budget",
    });
    expect(judge({ graphql: fullBudget }).rule.judgeFloor()).toBeUndefined();
  });

  it("stops background spending below the floor, and the status says until when", () => {
    const { rule, told } = judge();
    expect(rule.maySpend("background")).toBe(false);
    expect(told).toEqual([
      { paused: { until: fullBudget.resetAt, reason: "budget" } },
    ]);
  });

  it("lets what is asked for directly spend from the reserve, the status left alone", () => {
    const { rule, told } = judge();
    expect(rule.maySpend("asked")).toBe(true);
    expect(told).toEqual([]);
  });

  it("leaves a rate-limit pause to its reset", () => {
    const later = new Date(clock.getTime() + 60_000);
    const limited = {
      ...settled,
      paused: { until: later, reason: "rateLimit" as const },
    };
    const { rule, told } = judge(low, limited);
    expect(rule.maySpend("background")).toBe(false);
    expect(told).toEqual([]);
  });
});
