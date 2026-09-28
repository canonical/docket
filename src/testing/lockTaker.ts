/**
 * A docket process that finds the fetch lock untouched for two seconds and
 * takes it over, started by the lock's tests to prove that the process it
 * took the lock from leaves the lock alone.
 *
 * Usage: bun src/testing/lockTaker.ts <cache folder>
 *
 * It prints `waiting` as it starts to wait for the lock. Once it holds the
 * lock, it keeps it for three seconds, then prints `kept` when the
 * lock stayed its own throughout, or `lost` when another process removed
 * it, and gives it up.
 */
import { join } from "node:path";
import { lock } from "proper-lockfile";

const [directory = ""] = process.argv.slice(2);
let lost = false;
console.log("waiting");
const release = await lock(directory, {
  lockfilePath: join(directory, "fetch.lock"),
  stale: 2_000,
  update: 1_000,
  retries: { forever: true, minTimeout: 50, maxTimeout: 100 },
  onCompromised: () => {
    lost = true;
  },
});
await new Promise((resolve) => setTimeout(resolve, 3_000));
console.log(lost ? "lost" : "kept");
if (!lost) await release();
