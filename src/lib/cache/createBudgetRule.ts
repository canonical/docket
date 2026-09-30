import type { Budgets } from "../provider/index.js";
import findBudgetFloor from "./findBudgetFloor.js";
import type { CacheStatus } from "./types.js";

/** What the budget floor's rule reads of the cache it serves. */
export interface BudgetRuleOptions {
  /** The mirror of the budgets, this process's own answers joined. */
  readonly readFigures: () => Budgets;
  /** The cache's current time. */
  readonly now: () => Date;
  /** The status the cache gives out. */
  readonly status: () => CacheStatus;
  /** Gives out `change` to the status, without handing out the threads. */
  readonly publish: (change: Partial<CacheStatus>) => void;
}

/**
 * The budget floor's rule for one cache, judged on its mirror of the
 * budgets at the cache's current time: the floor keeps what is left below
 * it for the user's own requests, so docket's own background spending
 * stops there, and what the user or an agent asks for directly never
 * asks.
 */
export interface BudgetRule {
  /** Until when the budget is below its floor, or `undefined` above it. */
  judgeFloor(): { readonly until: Date; readonly reason: "budget" } | undefined;
  /** Whether docket may spend points of its own: above the floor. */
  maySpend(): boolean;
  /**
   * Gives the floor, as `judgeFloor` finds it, to the status, with its
   * reset, unless the rate limit pauses the cycle until a later time.
   *
   * @note Impure: writes the status through `publish`.
   */
  publishFloor(): void;
}

/** The budget floor's rule for the cache `options` read. */
export default function createBudgetRule({
  readFigures,
  now,
  status,
  publish,
}: BudgetRuleOptions): BudgetRule {
  const judgeFloor = () => findBudgetFloor(readFigures().graphql, now());
  return {
    judgeFloor,
    maySpend: () => judgeFloor() === undefined,
    publishFloor() {
      const { paused } = status();
      if (paused?.reason === "rateLimit" && now() < paused.until) return;
      publish({ paused: judgeFloor() });
    },
  };
}
