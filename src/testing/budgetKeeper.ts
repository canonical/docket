/**
 * A docket process whose answers report falling figures of the queries'
 * budget, keeping each in its budget file as it hears it, started by the
 * budget mirror's tests to prove what processes leave one another.
 *
 * Usage: bun src/testing/budgetKeeper.ts <cache folder> <figures> [go file]
 *
 * `figures` are the remaining points, comma-separated, in the order heard.
 * With a go file, it keeps the last figure only once that file exists.
 */
import { existsSync } from "node:fs";
import { createCache } from "../lib/cache/index.js";
import type { Budgets } from "../lib/provider/index.js";
import { fakeProvider, fullBudget } from "./provider.js";

const [directory = "", figures = "", go] = process.argv.slice(2);
let heard: Budgets = {};
const cache = createCache({
  provider: fakeProvider({ readBudgets: () => heard }),
  repos: ["example-org/example-repo"],
  directory,
  now: () => new Date("2026-09-28T10:00:00Z"),
});
const all = figures.split(",").map(Number);
for (const [index, remaining] of all.entries()) {
  if (go && index === all.length - 1) {
    while (!existsSync(go)) await new Promise((r) => setTimeout(r, 10));
  }
  heard = { graphql: { ...fullBudget, remaining } };
  await cache.keepBudget();
}
