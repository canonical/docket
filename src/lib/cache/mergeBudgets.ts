import type { Budget, Budgets } from "../provider/index.js";

/**
 * The later of two reports of one budget: the one of the later window,
 * and within one window the one with less left, since what remains of a
 * window only falls. Any process may have heard either last, so no
 * process's clock decides.
 */
const findLater = (
  one: Budget | undefined,
  other: Budget | undefined,
): Budget | undefined => {
  if (!one || !other) return one ?? other;
  const apart = one.resetAt.getTime() - other.resetAt.getTime();
  if (apart !== 0) return apart > 0 ? one : other;
  return one.remaining <= other.remaining ? one : other;
};

/**
 * The budgets two sources report, such as the cache file's and this
 * process's own answers', as one: for each kind, the later report.
 */
export default function mergeBudgets(one: Budgets, other: Budgets): Budgets {
  const graphql = findLater(one.graphql, other.graphql);
  const rest = findLater(one.rest, other.rest);
  return { ...(graphql && { graphql }), ...(rest && { rest }) };
}
