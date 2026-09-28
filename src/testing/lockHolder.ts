/**
 * A docket process that takes the fetch lock, stalls until another process
 * takes the lock over, then fails and exits, started by the lock's tests
 * to prove that its exit leaves the other process's lock alone.
 *
 * Usage: bun src/testing/lockHolder.ts <cache folder>
 *
 * It prints `holding` once it holds the lock, then blocks, touching the
 * lock no more, until the lock in the folder is another's. Its task then
 * fails, and it prints `failed` and exits with code 3.
 */
import { statSync } from "node:fs";
import { join } from "node:path";
import withFetchLock from "../lib/cache/withFetchLock.js";

const [directory = ""] = process.argv.slice(2);
const lockfile = join(directory, "fetch.lock");
const touched = () => statSync(lockfile, { throwIfNoEntry: false })?.mtimeMs;

await withFetchLock(directory, async () => {
  const own = touched();
  console.log("holding");
  // Blocks the event loop, as a laptop that sleeps does, so the lock goes
  // untouched until the other process takes it.
  const pause = new Int32Array(new SharedArrayBuffer(4));
  for (let now = touched(); now === undefined || now === own; now = touched()) {
    Atomics.wait(pause, 0, 0, 20);
  }
  throw new Error("no answer");
}).catch(() => {
  console.log("failed");
  process.exit(3);
});
