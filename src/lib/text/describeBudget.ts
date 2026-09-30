import type { Budget } from "../provider/index.js";
import { budgetShownBelow } from "./constants.js";

/**
 * What both faces say of the queries' budget, such as
 * `budget 35% · resets 14:20`, the reset in `timezone` on the 24-hour
 * clock: only while less than `budgetShownBelow` of it is left at `now`,
 * and nothing otherwise, or once it has reset, or while none is known.
 */
export default function describeBudget(
  budget: Budget | undefined,
  now: Date,
  timezone: string,
): string {
  if (!budget || now >= budget.resetAt) return "";
  const { limit, remaining, resetAt } = budget;
  if (remaining >= limit * budgetShownBelow) return "";
  const share = Math.floor((remaining * 100) / limit);
  const resets = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(resetAt);
  return `budget ${share}% · resets ${resets}`;
}
