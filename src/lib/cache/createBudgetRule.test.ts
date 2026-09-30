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
const floored = { graphql: { ...fullBudget, remaining: 900 } };

/** The rule over `figures`, with the status changes it gives out. */
const judge = (figures = floored, status = settled) => {
  const told: Partial<CacheStatus>[] = [];
  const rule = createBudgetRule({
    readFigures: () => figures,
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

  it("stops background spending below the floor, however often it is asked, and writes nothing", () => {
    const { rule, told } = judge();
    expect(rule.maySpend()).toBe(false);
    expect(rule.maySpend()).toBe(false);
    expect(judge({ graphql: fullBudget }).rule.maySpend()).toBe(true);
    expect(told).toEqual([]);
  });

  it("gives the status the floor with its reset, and lifts it above the floor", () => {
    const { rule, told } = judge();
    rule.publishFloor();
    const above = judge({ graphql: fullBudget });
    above.rule.publishFloor();
    expect([...told, ...above.told]).toEqual([
      { paused: { until: fullBudget.resetAt, reason: "budget" } },
      { paused: undefined },
    ]);
  });

  it("leaves a rate-limit pause to its reset", () => {
    const later = new Date(clock.getTime() + 60_000);
    const limited = {
      ...settled,
      paused: { until: later, reason: "rateLimit" as const },
    };
    const { rule, told } = judge(floored, limited);
    rule.publishFloor();
    expect(told).toEqual([]);
    const past = {
      ...settled,
      paused: { until: clock, reason: "rateLimit" as const },
    };
    const lapsed = judge(floored, past);
    lapsed.rule.publishFloor();
    expect(lapsed.told).toHaveLength(1);
  });
});
