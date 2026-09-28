/**
 * A docket process reading through the shared cache, started by the
 * cache's tests to prove that two processes fetch once between them.
 *
 * Usage: bun src/testing/cacheReader.ts <cache folder> <fetch log>
 *
 * Each snapshot it fetches appends a line to the fetch log, and takes a
 * moment, so a second process arrives while the first holds the lock. It
 * prints the numbers of the threads it read.
 */
import { appendFileSync } from "node:fs";
import { createCache } from "../lib/cache/index.js";
import { thread } from "./facts.js";
import { fakeProvider } from "./provider.js";

const [directory = "", log = ""] = process.argv.slice(2);
const provider = fakeProvider({
  async snapshot() {
    appendFileSync(log, `${process.pid}\n`);
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { threads: [thread({ number: 7 })], cursor: null };
  },
});
const cache = createCache({
  provider,
  repos: ["example-org/example-repo"],
  directory,
  now: () => new Date(),
});
const { threads } = await cache.read(300_000);
console.log(JSON.stringify(threads.map(({ number }) => number)));
