import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dehydrate, QueryClient } from "@tanstack/query-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { thread } from "../../testing/facts.js";
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

/** A cache file holding one repository's threads. */
function stateOf(threads: unknown, fullRefreshAt?: Date) {
  const client = new QueryClient();
  client.setQueryData(["snapshot", "example-org/example-repo"], threads, {
    updatedAt: Date.parse("2026-09-28T10:00:00Z"),
  });
  return { state: dehydrate(client), fullRefreshAt };
}

describe("writeCacheFile", () => {
  it("writes what readCacheFile reads back, dates as dates", async () => {
    const state = stateOf([thread()]);
    await writeCacheFile(file, state);
    const read = await readCacheFile(file);
    expect(read?.state.queries[0]?.state.data).toEqual([thread()]);
    expect(read?.state.queries[0]?.state.dataUpdatedAt).toBe(
      Date.parse("2026-09-28T10:00:00Z"),
    );
    expect(read?.fullRefreshAt).toBeUndefined();
  });

  it("writes when the last full refresh started, which readCacheFile reads back", async () => {
    const started = new Date("2026-09-28T09:59:00Z");
    await writeCacheFile(file, stateOf([], started));
    expect((await readCacheFile(file))?.fullRefreshAt).toEqual(started);
  });

  it("writes a title written like a date as text", async () => {
    const title = "2026-09-28T10:00:00.000Z";
    await writeCacheFile(file, stateOf([thread({ title })]));
    const read = await readCacheFile(file);
    expect(read?.state.queries[0]?.state.data).toEqual([thread({ title })]);
  });

  it("leaves a file only its owner can read, in a folder only its owner can enter", async () => {
    await writeCacheFile(file, stateOf([]));
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect((await stat(join(root, "docket"))).mode & 0o777).toBe(0o700);
  });

  it("replaces the file whole, leaving no temporary file behind", async () => {
    await writeCacheFile(file, stateOf([thread({ number: 1 })]));
    await writeCacheFile(file, stateOf([thread({ number: 2 })]));
    expect(await readdir(join(root, "docket"))).toEqual(["snapshots.json"]);
    const read = await readCacheFile(file);
    expect(read?.state.queries[0]?.state.data).toEqual([thread({ number: 2 })]);
  });

  it("leaves no temporary file behind when the file cannot be replaced", async () => {
    await mkdir(join(file, "in-the-way"), { recursive: true });
    await expect(writeCacheFile(file, stateOf([]))).rejects.toThrow();
    expect(await readdir(join(root, "docket"))).toEqual(["snapshots.json"]);
  });
});
