import type { Provider } from "../provider/index.js";
import { budgetFloor } from "./constants.js";

/**
 * Until when the refresh cycle spends no points, or `undefined` while it
 * may: when less than `budgetFloor` of the hourly budget remains, the rest
 * is left to the user's own requests until the budget resets.
 *
 * @note Impure: reads the budget from the provider.
 */
export default async function findBudgetFloor(
  provider: Pick<Provider, "budget">,
  at: Date,
): Promise<{ readonly until: Date; readonly reason: "budget" } | undefined> {
  const { limit, remaining, resetAt } = await provider.budget();
  return at < resetAt && remaining < limit * budgetFloor
    ? { until: resetAt, reason: "budget" }
    : undefined;
}
