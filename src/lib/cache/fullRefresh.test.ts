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
    cache.subscribe(() => {
      if (cache.status().refreshing) shown.push(cache.threads().threads.length);
    });
    await cache.fullRefresh();
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

  it("reports each repository's stage, page by page, fetching everything whole while nothing is shown, and keeps the stages after", async () => {
    const cache = open(fakeProvider({ snapshot: paged(2) }), [repo, docs]);
    await cache.read(300 * second);
    later(10 * second);
    const seen: unknown[] = [];
    cache.subscribe(() => {
      const { whole, stages } = cache.status();
      seen.push({ whole, docs: stages.at(1)?.stage });
    });
    await cache.fullRefresh();
    expect(seen).toContainEqual({ whole: true, docs: { kind: "waiting" } });
    expect(seen).toContainEqual({
      whole: true,
      docs: { kind: "reading", fetched: 1, total: 2 },
    });
    expect(cache.status()).toMatchObject({
      refreshing: false,
      whole: false,
      stages: [
        { repo, stage: { kind: "done", threads: 1, fetched: 2, total: 2 } },
        {
          repo: docs,
          stage: { kind: "done", threads: 1, fetched: 2, total: 2 },
        },
      ],
    });
  });

  it("fetches whole on the first read too, with nothing cached", async () => {
    const cache = open(fakeProvider({ snapshot: paged(1) }));
    const whole: boolean[] = [];
    cache.subscribe(() => whole.push(cache.status().whole));
    await cache.read(300 * second);
    expect(whole).toContain(true);
  });

  it("refuses another within 60 seconds, saying so and in the status when one is available", async () => {
    const snapshot = paged(1);
    const cache = open(fakeProvider({ snapshot }));
    expect(await cache.fullRefresh()).toBe(true);
    later(17_500);
    expect(await cache.fullRefresh()).toBe(false);
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(cache.status().fullRefreshAvailableAt).toEqual(
      new Date("2026-09-28T10:01:00Z"),
    );
    later(42_500);
    await cache.fullRefresh();
    expect(snapshot).toHaveBeenCalledTimes(2);
    expect(cache.status().fullRefreshAvailableAt).toBeUndefined();
  });

  it("refuses one within 60 seconds of another process's, saying in the status when one is available", async () => {
    const first = paged(1);
    await open(fakeProvider({ snapshot: first })).fullRefresh();
    later(second);
    const snapshot = paged(1);
    const cache = open(fakeProvider({ snapshot }));
    await cache.fullRefresh();
    expect(snapshot).not.toHaveBeenCalled();
    expect(cache.status().fullRefreshAvailableAt).toEqual(
      new Date("2026-09-28T10:01:00Z"),
    );
    later(59 * second);
    await cache.fullRefresh();
    expect(snapshot).toHaveBeenCalledTimes(1);
  });

  it("fetches once when two processes ask for one together", async () => {
    const one = paged(1);
    const two = paged(1);
    const first = open(fakeProvider({ snapshot: one }));
    const other = open(fakeProvider({ snapshot: two }));
    await Promise.all([first.fullRefresh(), other.fullRefresh()]);
    expect(one.mock.calls.length + two.mock.calls.length).toBe(1);
    const refused = [first, other].map(
      (cache) => cache.status().fullRefreshAvailableAt,
    );
    expect(refused).toContainEqual(new Date("2026-09-28T10:01:00Z"));
  });

  it("keeps the provider's error in the status rather than throwing it, and says the data was thrown away", async () => {
    const error = providerError("GITHUB_REQUEST_FAILED");
    const cache = open(
      fakeProvider({
        snapshot: async () => {
          throw error;
        },
      }),
    );
    expect(await cache.fullRefresh()).toBe(true);
    expect(cache.status()).toMatchObject({
      failure: error,
      refreshing: false,
      whole: false,
    });
  });
});
