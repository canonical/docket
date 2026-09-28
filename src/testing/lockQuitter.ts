/**
 * A docket process that ends while it holds the fetch lock, its task
 * still waiting on an answer, as docket ends when the terminal interface
 * closes during a request GitHub never answers. Started by the lock's
 * tests to prove the exit leaves no lock behind.
 *
 * Usage: bun src/testing/lockQuitter.ts <cache folder>
 *
 * It prints `holding` once it holds the lock, then exits with code 0.
 */
import withFetchLock from "../lib/cache/withFetchLock.js";

const [directory = ""] = process.argv.slice(2);

await withFetchLock(directory, async () => {
  console.log("holding");
  setTimeout(() => process.exit(0), 50);
  await new Promise(() => {});
});
