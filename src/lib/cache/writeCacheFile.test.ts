import { spawn } from "node:child_process";
import { once } from "node:events";
import { readdirSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dehydrate, QueryClient } from "@tanstack/query-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { thread } from "../../testing/facts.js";
import { fullBudget } from "../../testing/provider.js";
import identifyFile from "./identifyFile.js";
import readCacheFile from "./readCacheFile.js";
import writeCacheFile from "./writeCacheFile.js";

let root: string;
let file: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-cache-"));
  file = join(root, "docket", "snapshots.json");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** A writer that has no use for the name of the file it writes. */
const ignore = () => undefined;

/** A cache file holding one repository's threads. */
function stateOf(threads: unknown, fullRefreshAt?: Date) {
  const client = new QueryClient();
  client.setQueryData(["snapshot", "example-org/example-repo"], threads, {
    updatedAt: Date.parse("2026-09-28T10:00:00Z"),
  });
  return { state: dehydrate(client), fullRefreshAt, budget: {} };
}

describe("writeCacheFile", () => {
  it("writes what readCacheFile reads back, dates as dates", async () => {
    const state = stateOf([thread()]);
    await writeCacheFile(file, state, ignore);
    const read = await readCacheFile(file);
    expect(read?.state.queries[0]?.state.data).toEqual([thread()]);
    expect(read?.state.queries[0]?.state.dataUpdatedAt).toBe(
      Date.parse("2026-09-28T10:00:00Z"),
    );
    expect(read?.fullRefreshAt).toBeUndefined();
  });

  it("names the file it writes, as identifyFile names it, while the file still waits beside its place", async () => {
    let claimed: string | undefined;
    let waiting: string[] = [];
    await writeCacheFile(file, stateOf([]), (written) => {
      claimed = written;
      waiting = readdirSync(join(root, "docket"));
    });
    expect(claimed).toBeDefined();
    expect(claimed).toBe(await identifyFile(file));
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatch(/^snapshots\.json\..+\.tmp$/);
  });

  it("writes when the last full refresh started, which readCacheFile reads back", async () => {
    const started = new Date("2026-09-28T09:59:00Z");
    await writeCacheFile(file, stateOf([], started), ignore);
    expect((await readCacheFile(file))?.fullRefreshAt).toEqual(started);
  });

  it("writes the budgets it mirrors, which readCacheFile reads back", async () => {
    const budget = {
      graphql: fullBudget,
      rest: { ...fullBudget, remaining: 10 },
    };
    await writeCacheFile(file, { ...stateOf([]), budget }, ignore);
    expect((await readCacheFile(file))?.budget).toEqual(budget);
  });

  it("writes a title written like a date as text", async () => {
    const title = "2026-09-28T10:00:00.000Z";
    await writeCacheFile(file, stateOf([thread({ title })]), ignore);
    const read = await readCacheFile(file);
    expect(read?.state.queries[0]?.state.data).toEqual([thread({ title })]);
  });

  it("leaves a file only its owner can read, in a folder only its owner can enter", async () => {
    await writeCacheFile(file, stateOf([]), ignore);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect((await stat(join(root, "docket"))).mode & 0o777).toBe(0o700);
  });

  it("replaces the file whole, leaving no temporary file behind", async () => {
    await writeCacheFile(file, stateOf([thread({ number: 1 })]), ignore);
    await writeCacheFile(file, stateOf([thread({ number: 2 })]), ignore);
    expect(await readdir(join(root, "docket"))).toEqual(["snapshots.json"]);
    const read = await readCacheFile(file);
    expect(read?.state.queries[0]?.state.data).toEqual([thread({ number: 2 })]);
  });

  it("leaves no temporary file behind when the file cannot be replaced", async () => {
    await mkdir(join(file, "in-the-way"), { recursive: true });
    await expect(writeCacheFile(file, stateOf([]), ignore)).rejects.toThrow();
    expect(await readdir(join(root, "docket"))).toEqual(["snapshots.json"]);
  });

  it("leaves the old file whole when the process ends before the new one takes its place", async () => {
    await writeCacheFile(file, stateOf([thread({ number: 1 })]), ignore);
    const writer = spawn(process.execPath, [
      "src/testing/writeQuitter.ts",
      file,
    ]);
    expect(await once(writer, "exit")).toEqual([0, null]);
    const read = await readCacheFile(file);
    expect(read?.state.queries[0]?.state.data).toEqual([thread({ number: 1 })]);
    // The new contents stay in their temporary file, which no reader opens.
    const left = (await readdir(join(root, "docket"))).sort();
    expect(left).toEqual([
      "snapshots.json",
      expect.stringMatching(/^snapshots\.json\..+\.tmp$/),
    ]);
  });
});
