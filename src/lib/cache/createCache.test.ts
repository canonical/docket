import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import {
  everyCapability,
  fakeProvider,
  providerError,
} from "../../testing/provider.js";
import type { Provider } from "../provider/index.js";
import createCache from "./createCache.js";

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";
const minute = 60_000;

let root: string;
let directory: string;
let clock: Date;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-cache-"));
  directory = join(root, "docket");
  clock = new Date("2026-09-28T10:00:00Z");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** A cache on the test's folder, reading the test's clock. */
const open = (provider: Provider, repos = [repo], folder = directory) =>
  createCache({ provider, repos, directory: folder, now: () => clock });

/** A provider whose snapshots each hold one open thread of the repository. */
const counting = (overrides: Partial<Provider> = {}) =>
  fakeProvider({
    snapshot: vi.fn(async (name: string) => ({
      threads: [thread({ repo: name, number: name === repo ? 1 : 2 })],
      cursor: { since: "2026-09-28T09:59:00Z" },
    })),
    ...overrides,
  });

describe("createCache", () => {
  it("fetches every repository whole on the first read, and dates the data", async () => {
    const provider = counting();
    const read = await open(provider, [repo, docs]).read(5 * minute);
    expect(read).toEqual({
      threads: [thread({ number: 1 }), thread({ repo: docs, number: 2 })],
      syncedAt: clock,
    });
    expect(provider.snapshot).toHaveBeenCalledTimes(2);
  });

  it("answers from the cache while the data is younger than the maximum age", async () => {
    const provider = counting();
    const cache = open(provider);
    await cache.read(5 * minute);
    clock = new Date(clock.getTime() + 4 * minute);
    await cache.read(5 * minute);
    expect(provider.snapshot).toHaveBeenCalledTimes(1);
  });

  it("answers from what another process fetched, without fetching", async () => {
    await open(counting()).read(5 * minute);
    const provider = counting();
    const read = await open(provider).read(5 * minute);
    expect(read.threads).toEqual([thread({ number: 1 })]);
    expect(provider.snapshot).not.toHaveBeenCalled();
  });

  it("syncs older data, dating it anew when the free check sees no change", async () => {
    const provider = counting({
      probe: vi.fn(async () => ({ changed: false, tag: '"tag-1"' })),
    });
    const cache = open(provider);
    await cache.read(5 * minute);
    clock = new Date(clock.getTime() + 6 * minute);
    const read = await cache.read(5 * minute);
    expect(provider.probe).toHaveBeenCalledTimes(2);
    expect(provider.snapshot).toHaveBeenCalledTimes(1);
    expect(read.syncedAt).toEqual(clock);
  });

  it("fetches once when two readers want older data together", async () => {
    const first = counting();
    const second = counting();
    const [one, two] = await Promise.all([
      open(first).read(5 * minute),
      open(second).read(5 * minute),
    ]);
    expect(one).toEqual(two);
    const fetches =
      vi.mocked(first.snapshot).mock.calls.length +
      vi.mocked(second.snapshot).mock.calls.length;
    expect(fetches).toBe(1);
  });

  it("fetches once when two processes want older data together", async () => {
    const run = promisify(execFile);
    const log = join(root, "fetches.log");
    const reader = ["src/testing/cacheReader.ts", directory, log];
    const [one, two] = await Promise.all([
      run(process.execPath, reader),
      run(process.execPath, reader),
    ]);
    expect(one.stdout.trim()).toBe("[7]");
    expect(two.stdout.trim()).toBe("[7]");
    expect((await readFile(log, "utf8")).trim().split("\n")).toHaveLength(1);
  });

  it("keeps its newer data when the file holds older data", async () => {
    const cache = open(counting());
    clock = new Date("2026-09-28T10:30:00Z");
    await cache.read(5 * minute);
    const elsewhere = join(root, "elsewhere");
    clock = new Date("2026-09-28T10:00:00Z");
    await open(
      counting({
        snapshot: async () => ({ threads: [], cursor: null }),
      }),
      [repo],
      elsewhere,
    ).read(5 * minute);
    await copyFile(
      join(elsewhere, "snapshots.json"),
      join(directory, "snapshots.json"),
    );
    await cache.load();
    expect(cache.threads()).toEqual({
      threads: [thread({ number: 1 })],
      syncedAt: new Date("2026-09-28T10:30:00Z"),
    });
  });

  it("reads again the checks still running on every sync", async () => {
    const running = thread({
      number: 3,
      kind: "pullRequest",
      checks: "running",
    });
    const provider = counting({
      snapshot: async () => ({ threads: [running], cursor: null }),
      refreshVolatile: vi.fn(async () => [
        { repo, number: 3, checks: "passing" as const },
      ]),
    });
    const read = await open(provider).read(5 * minute);
    expect(provider.refreshVolatile).toHaveBeenCalledWith([running]);
    expect(read.threads).toEqual([{ ...running, checks: "passing" }]);
  });

  it("reads no checks from a provider that declares none", async () => {
    const capabilities = new Set(everyCapability);
    capabilities.delete("checks");
    const provider = counting({
      capabilities: () => capabilities,
      snapshot: async () => ({
        threads: [thread({ kind: "pullRequest", checks: "running" })],
        cursor: null,
      }),
      refreshVolatile: vi.fn(),
    });
    await open(provider).read(5 * minute);
    expect(provider.refreshVolatile).not.toHaveBeenCalled();
  });

  it("reads no checks when none are running", async () => {
    const provider = counting({ refreshVolatile: vi.fn() });
    await open(provider).read(5 * minute);
    expect(provider.refreshVolatile).not.toHaveBeenCalled();
  });

  it("throws the provider's error, and holds no data", async () => {
    const cache = open(
      counting({
        snapshot: async () => {
          throw providerError("GITHUB_REQUEST_FAILED");
        },
      }),
    );
    await expect(cache.read(5 * minute)).rejects.toMatchObject({
      code: "GITHUB_REQUEST_FAILED",
    });
    expect(cache.threads()).toEqual({ threads: [], syncedAt: undefined });
    expect(cache.status().refreshing).toBe(false);
  });

  it("tells its listeners while it refreshes, and stops telling one that leaves", async () => {
    const cache = open(counting());
    const seen: boolean[] = [];
    const leave = cache.subscribe(() => seen.push(cache.status().refreshing));
    await cache.read(5 * minute);
    expect(seen).toContain(true);
    expect(seen.at(-1)).toBe(false);
    leave();
    const count = seen.length;
    await cache.load();
    expect(seen).toHaveLength(count);
  });

  it("gives the same threads and status on every call until they change", async () => {
    const cache = open(counting());
    const threads = cache.threads();
    const status = cache.status();
    expect(cache.threads()).toBe(threads);
    expect(cache.status()).toBe(status);
    await cache.read(5 * minute);
    const read = cache.threads();
    const synced = cache.status();
    expect(read).not.toBe(threads);
    expect(synced).not.toBe(status);
    await cache.load();
    await cache.read(5 * minute);
    expect(cache.threads()).toBe(read);
    expect(cache.status()).toBe(synced);
  });

  it("holds nothing, and fetches nothing, with no repository to watch", async () => {
    const provider = counting();
    const read = await open(provider, []).read(5 * minute);
    expect(read).toEqual({ threads: [], syncedAt: undefined });
    expect(provider.snapshot).not.toHaveBeenCalled();
  });
});
