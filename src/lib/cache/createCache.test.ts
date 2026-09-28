import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alice, thread } from "../../testing/facts.js";
import {
  everyCapability,
  fakeProvider,
  providerError,
} from "../../testing/provider.js";
import type { ThreadEvent } from "../events/index.js";
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

  it("fails with CACHE_UNUSABLE when the cache folder cannot be made", async () => {
    const file = join(root, "file");
    await writeFile(file, "");
    const cache = open(counting(), [repo], join(file, "docket"));
    await expect(cache.read(5 * minute)).rejects.toMatchObject({
      code: "CACHE_UNUSABLE",
      message: expect.stringContaining(": ENOTDIR: "),
    });
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

describe("createCache, for events", () => {
  const since = new Date("2026-09-20T10:00:00Z");
  /** A provider with one comment on the repository, a day before the clock. */
  const withEvents = (overrides: Partial<Provider> = {}) =>
    fakeProvider({
      events: vi.fn(
        async (): Promise<readonly ThreadEvent[]> => [
          {
            kind: "commented",
            thread: thread(),
            actor: alice,
            at: new Date("2026-09-27T10:00:00Z"),
          },
        ],
      ),
      ...overrides,
    });

  it("fetches a repository's events once, then answers from the cache while they are younger than the maximum age", async () => {
    const provider = withEvents();
    const first = await open(provider).readEvents(repo, since, 5 * minute);
    expect(first.syncedAt).toEqual(clock);
    expect(first.events.map(({ kind }) => kind)).toEqual(["commented"]);
    clock = new Date(clock.getTime() + 4 * minute);
    // Another process, reading the file this one wrote.
    const again = await open(provider).readEvents(
      repo,
      new Date(since.getTime() + 4 * minute),
      5 * minute,
    );
    expect(again).toEqual(first);
    expect(provider.events).toHaveBeenCalledTimes(1);
  });

  it("fetches once when two readers want the events together", async () => {
    const first = withEvents();
    const second = withEvents();
    const [one, two] = await Promise.all([
      open(first).readEvents(repo, since, 5 * minute),
      open(second).readEvents(repo, since, 5 * minute),
    ]);
    expect(one).toEqual(two);
    const fetches =
      vi.mocked(first.events).mock.calls.length +
      vi.mocked(second.events).mock.calls.length;
    expect(fetches).toBe(1);
  });

  it("fetches again once the events are as old as the maximum age, or reach back less far than asked", async () => {
    const provider = withEvents();
    const cache = open(provider);
    await cache.readEvents(repo, since, 5 * minute);
    clock = new Date(clock.getTime() + 5 * minute);
    await cache.readEvents(repo, since, 5 * minute);
    expect(provider.events).toHaveBeenCalledTimes(2);
    const earlier = new Date(since.getTime() - minute);
    await cache.readEvents(repo, earlier, 5 * minute);
    expect(provider.events).toHaveBeenLastCalledWith(repo, earlier);
    expect(provider.events).toHaveBeenCalledTimes(3);
  });

  it("holds the events however old, from the time asked on, and none it never fetched", async () => {
    const provider = withEvents();
    const cache = open(provider);
    expect(cache.findEvents(repo, since)).toBeUndefined();
    await cache.readEvents(repo, since, 5 * minute);
    clock = new Date(clock.getTime() + 60 * minute);
    expect(cache.findEvents(repo, since)?.events).toHaveLength(1);
    expect(
      cache.findEvents(repo, new Date("2026-09-28T00:00:00Z"))?.events,
    ).toEqual([]);
    expect(
      cache.findEvents(repo, new Date(since.getTime() - 1)),
    ).toBeUndefined();
  });

  it("throws the provider's error, and CACHE_UNUSABLE for a folder it cannot make", async () => {
    const limited = withEvents({
      events: () => Promise.reject(providerError("GITHUB_RATE_LIMITED")),
    });
    await expect(
      open(limited).readEvents(repo, since, 5 * minute),
    ).rejects.toMatchObject({ code: "GITHUB_RATE_LIMITED" });
    const file = join(root, "file");
    await writeFile(file, "");
    const cache = open(withEvents(), [repo], join(file, "docket"));
    await expect(
      cache.readEvents(repo, since, 5 * minute),
    ).rejects.toMatchObject({ code: "CACHE_UNUSABLE" });
  });
});

describe("createCache, for a repository's own file", () => {
  const path = ".github/docket.yaml";
  /** A provider whose repository holds `text` at the path, or no file. */
  const withFile = (text: string | undefined) =>
    fakeProvider({ readFile: vi.fn(async () => text) });

  it("reads a repository's file once, then answers from the cache while it is younger than the maximum age", async () => {
    const provider = withFile("version: 1\n");
    const first = await open(provider).readFile(repo, path, 5 * minute);
    expect(first).toEqual({ text: "version: 1\n", syncedAt: clock });
    clock = new Date(clock.getTime() + 4 * minute);
    // Another process, reading the file this one wrote.
    const again = await open(provider).readFile(repo, path, 5 * minute);
    expect(again).toEqual(first);
    expect(provider.readFile).toHaveBeenCalledTimes(1);
    expect(provider.readFile).toHaveBeenCalledWith(repo, path);
  });

  it("keeps a repository's lack of a file as it keeps a file", async () => {
    const provider = withFile(undefined);
    const cache = open(provider);
    await cache.readFile(repo, path, 5 * minute);
    const again = await open(provider).readFile(repo, path, 5 * minute);
    expect(again).toEqual({ text: undefined, syncedAt: clock });
    expect(provider.readFile).toHaveBeenCalledTimes(1);
  });

  it("reads once when two readers want the file together", async () => {
    const first = withFile("version: 1\n");
    const second = withFile("version: 1\n");
    const [one, two] = await Promise.all([
      open(first).readFile(repo, path, 5 * minute),
      open(second).readFile(repo, path, 5 * minute),
    ]);
    expect(one).toEqual(two);
    const reads =
      vi.mocked(first.readFile).mock.calls.length +
      vi.mocked(second.readFile).mock.calls.length;
    expect(reads).toBe(1);
  });

  it("reads the file again once it is as old as the maximum age, and each repository's apart", async () => {
    const provider = withFile("version: 1\n");
    const cache = open(provider, [repo, docs]);
    await cache.readFile(repo, path, 5 * minute);
    await cache.readFile(docs, path, 5 * minute);
    expect(provider.readFile).toHaveBeenCalledTimes(2);
    clock = new Date(clock.getTime() + 5 * minute);
    await cache.readFile(repo, path, 5 * minute);
    expect(provider.readFile).toHaveBeenCalledTimes(3);
  });

  it("throws the provider's error, and CACHE_UNUSABLE for a folder it cannot make", async () => {
    const limited = fakeProvider({
      readFile: () => Promise.reject(providerError("GITHUB_RATE_LIMITED")),
    });
    await expect(
      open(limited).readFile(repo, path, 5 * minute),
    ).rejects.toMatchObject({ code: "GITHUB_RATE_LIMITED" });
    const file = join(root, "file");
    await writeFile(file, "");
    const cache = open(withFile("version: 1\n"), [repo], join(file, "docket"));
    await expect(cache.readFile(repo, path, 5 * minute)).rejects.toMatchObject({
      code: "CACHE_UNUSABLE",
    });
  });
});

describe("createCache, after a write", () => {
  it("brings a repository's changed threads up to date at once, for every process", async () => {
    const provider = counting();
    const cache = open(provider);
    await cache.read(5 * minute);
    const assigned = thread({ number: 1, assignees: [alice] });
    vi.mocked(provider.snapshot).mockResolvedValueOnce({
      threads: [assigned],
      cursor: { since: "2026-09-28T10:00:00Z" },
    });
    const probe = vi.spyOn(provider, "probe");
    clock = new Date(clock.getTime() + minute);
    await cache.refreshRepo(repo);
    expect(provider.snapshot).toHaveBeenLastCalledWith(repo, {
      since: "2026-09-28T09:59:00Z",
    });
    expect(probe).not.toHaveBeenCalled();
    expect(cache.threads()).toEqual({ threads: [assigned], syncedAt: clock });
    const other = counting();
    expect(await open(other).read(5 * minute)).toEqual({
      threads: [assigned],
      syncedAt: clock,
    });
    expect(other.snapshot).not.toHaveBeenCalled();
  });

  it("leaves a repository it holds nothing of for the next read to fetch whole", async () => {
    const provider = counting();
    await open(provider).refreshRepo(repo);
    expect(provider.snapshot).not.toHaveBeenCalled();
  });

  it("throws the provider's error, and CACHE_UNUSABLE for a folder it cannot make", async () => {
    const provider = counting();
    const cache = open(provider);
    await cache.read(5 * minute);
    vi.mocked(provider.snapshot).mockRejectedValueOnce(
      providerError("GITHUB_REQUEST_FAILED"),
    );
    await expect(cache.refreshRepo(repo)).rejects.toMatchObject({
      code: "GITHUB_REQUEST_FAILED",
    });
    const file = join(root, "file");
    await writeFile(file, "");
    await expect(
      open(counting(), [repo], join(file, "docket")).refreshRepo(repo),
    ).rejects.toMatchObject({ code: "CACHE_UNUSABLE" });
  });
});
