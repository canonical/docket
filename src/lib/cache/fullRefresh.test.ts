import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import { fakeProvider, providerError } from "../../testing/provider.js";
import type { PageProgress, Provider } from "../provider/index.js";
import createCache from "./createCache.js";

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";
const second = 1_000;

let root: string;
let directory: string;
let clock: Date;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-full-"));
  directory = join(root, "docket");
  clock = new Date("2026-09-28T10:00:00Z");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const open = (provider: Provider, repos = [repo]) =>
  createCache({ provider, repos, directory, now: () => clock });
const later = (milliseconds: number) => {
  clock = new Date(clock.getTime() + milliseconds);
};

/** Snapshots of `pages` pages, each thread numbered by its page. */
const paged = (pages: number) =>
  vi.fn(
    async (
      name: string,
      _cursor: unknown,
      onPage?: (progress: PageProgress) => void,
    ) => {
      for (let fetched = 1; fetched <= pages; fetched += 1) {
        onPage?.({ fetched, total: pages });
      }
      return { threads: [thread({ repo: name, number: pages })], cursor: null };
    },
  );

describe("the full refresh of createCache", () => {
  it("discards what is cached and fetches everything again", async () => {
    const snapshot = paged(1);
    const cache = open(fakeProvider({ snapshot }));
    await cache.read(300 * second);
    const elsewhere: number[] = [];
    snapshot.mockImplementationOnce(async () => {
      // Another process loading the file meanwhile finds nothing.
      const other = open(fakeProvider());
      await other.load();
      elsewhere.push(other.threads().threads.length);
      return { threads: [thread({ number: 9 })], cursor: null };
    });
    later(10 * second);
    const shown: number[] = [];
    cache.subscribe(() => shown.push(cache.threads().threads.length));
    expect(await cache.fullRefresh()).toEqual({ refused: false });
    expect(shown[0]).toBe(0);
    expect(elsewhere).toEqual([0]);
    expect(cache.threads()).toEqual({
      threads: [thread({ number: 9 })],
      syncedAt: clock,
    });
    await expect(open(fakeProvider()).read(300 * second)).resolves.toEqual({
      threads: [thread({ number: 9 })],
      syncedAt: clock,
    });
  });

  it("reports each repository and each page while it fetches, then clears the progress", async () => {
    const cache = open(fakeProvider({ snapshot: paged(2) }), [repo, docs]);
    const progress: unknown[] = [];
    cache.subscribe(() => {
      const { fullRefresh } = cache.status();
      if (fullRefresh && progress.at(-1) !== fullRefresh)
        progress.push(fullRefresh);
    });
    await cache.fullRefresh();
    expect(progress).toEqual([
      { repo, position: 1, count: 2, fetched: 0, total: 0 },
      { repo, position: 1, count: 2, fetched: 1, total: 2 },
      { repo, position: 1, count: 2, fetched: 2, total: 2 },
      { repo: docs, position: 2, count: 2, fetched: 0, total: 0 },
      { repo: docs, position: 2, count: 2, fetched: 1, total: 2 },
      { repo: docs, position: 2, count: 2, fetched: 2, total: 2 },
    ]);
    expect(cache.status().fullRefresh).toBeUndefined();
  });

  it("reports progress on the first fetch too, with nothing cached", async () => {
    const cache = open(fakeProvider({ snapshot: paged(1) }));
    const progress: unknown[] = [];
    cache.subscribe(() => progress.push(cache.status().fullRefresh));
    await cache.read(300 * second);
    expect(progress).toContainEqual({
      repo,
      position: 1,
      count: 1,
      fetched: 1,
      total: 1,
    });
  });

  it("refuses another within 60 seconds, saying how many remain", async () => {
    const snapshot = paged(1);
    const cache = open(fakeProvider({ snapshot }));
    await cache.fullRefresh();
    later(17_500);
    expect(await cache.fullRefresh()).toEqual({ refused: true, seconds: 43 });
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(cache.status().fullRefreshAvailableAt).toEqual(
      new Date("2026-09-28T10:01:00Z"),
    );
    later(42_500);
    expect(await cache.fullRefresh()).toEqual({ refused: false });
    expect(snapshot).toHaveBeenCalledTimes(2);
    expect(cache.status().fullRefreshAvailableAt).toBeUndefined();
  });

  it("keeps the provider's error in the status rather than throwing it", async () => {
    const error = providerError("GITHUB_REQUEST_FAILED");
    const cache = open(
      fakeProvider({
        snapshot: async () => {
          throw error;
        },
      }),
    );
    expect(await cache.fullRefresh()).toEqual({ refused: false });
    expect(cache.status()).toMatchObject({
      failure: error,
      refreshing: false,
      fullRefresh: undefined,
    });
  });
});
