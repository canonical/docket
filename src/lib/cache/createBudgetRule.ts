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
 * budgets at the cache's current time. `judgeFloor` says until when the
 * budget is below its floor, or `undefined` while points may be spent.
 * `maySpend` says whether docket may spend points of its own: the one
 * rule of the floor, which keeps what is left below it for the user's own
 * requests. docket's own background spending stops below the floor, and
 * the status then says so, with the reset, unless the rate limit pauses
 * the cycle; what the user or an agent asks for directly never asks.
 */
export default function createBudgetRule({
  readFigures,
  now,
  status,
  publish,
}: BudgetRuleOptions) {
  const judgeFloor = () => findBudgetFloor(readFigures().graphql, now());
  const findFloor = () => {
    const floor = judgeFloor();
    const { paused } = status();
    if (paused?.reason !== "rateLimit" || now() >= paused.until) {
      publish({ paused: floor });
    }
    return floor;
  };
  const maySpend = () => findFloor() === undefined;
  return { judgeFloor, maySpend };
}
