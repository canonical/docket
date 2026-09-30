import { mkdir, mkdtemp, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import {
  fakeProvider,
  fullBudget,
  providerError,
} from "../../testing/provider.js";
import { waitUntil } from "../../testing/wait.js";
import type { Provider } from "../provider/index.js";
import createCache from "./createCache.js";

const repo = "example-org/example-repo";
const minute = 60_000;

let root: string;
let directory: string;
let clock: Date;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-refresh-"));
  directory = join(root, "docket");
  clock = new Date("2026-09-28T10:00:00Z");
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(root, { recursive: true, force: true });
});

const open = (provider: Provider) =>
  createCache({ provider, repos: [repo], directory, now: () => clock });
const later = (milliseconds: number) => {
  clock = new Date(clock.getTime() + milliseconds);
};
const counting = (overrides: Partial<Provider> = {}) =>
  fakeProvider({
    snapshot: vi.fn(async () => ({ threads: [thread()], cursor: null })),
    ...overrides,
  });
const failing = (error: Error) =>
  vi.fn(async () => {
    throw error;
  });

describe("the refresh step of createCache", () => {
  it("syncs data older than 120 seconds, and leaves fresher data alone", async () => {
    const provider = counting();
    const cache = open(provider);
    await cache.refresh();
    later(119_000);
    await cache.refresh();
    expect(provider.snapshot).toHaveBeenCalledTimes(1);
    later(1_000);
    await cache.refresh();
    expect(cache.status().syncedAt).toEqual(clock);
  });

  it("leaves data another process synced within 120 seconds alone", async () => {
    await open(counting()).refresh();
    later(minute);
    const provider = counting();
    await open(provider).refresh();
    expect(provider.snapshot).not.toHaveBeenCalled();
  });

  it("syncs an idle pane's data only once it is 30 minutes old, without the checks refresh or the whole hourly fetch", async () => {
    const running = thread({ kind: "pullRequest", checks: "running" });
    const provider = counting({
      snapshot: vi.fn(async () => ({ threads: [running], cursor: null })),
      refreshVolatile: vi.fn(async () => []),
    });
    const cache = open(provider);
    await cache.refresh();
    later(29 * minute);
    await cache.refresh("idle");
    expect(provider.snapshot).toHaveBeenCalledTimes(1);
    later(46 * minute);
    await cache.refresh("idle");
    expect(provider.snapshot).toHaveBeenCalledTimes(2);
    expect(provider.snapshot).toHaveBeenLastCalledWith(repo, null);
    expect(provider.refreshVolatile).toHaveBeenCalledTimes(1);
    expect(cache.status().syncedAt).toEqual(clock);
  });

  it("syncs at once on waking, however fresh, with the checks refresh and the whole fetch once it is due", async () => {
    const running = thread({ kind: "pullRequest", checks: "running" });
    const provider = counting({
      snapshot: vi.fn(async () => ({ threads: [running], cursor: null })),
      refreshVolatile: vi.fn(async () => []),
    });
    const cache = open(provider);
    await cache.refresh();
    later(minute);
    await cache.refresh("waking");
    expect(provider.snapshot).toHaveBeenCalledTimes(2);
    expect(provider.refreshVolatile).toHaveBeenCalledTimes(2);
    later(60 * minute);
    await cache.refresh("waking");
    expect(provider.snapshot).toHaveBeenLastCalledWith(
      repo,
      null,
      expect.any(Function),
    );
  });

  it("pauses until the budget resets when less than a fifth of it remains", async () => {
    const provider = counting({
      budget: () => ({ graphql: { ...fullBudget, remaining: 999 } }),
    });
    const cache = open(provider);
    await cache.refresh();
    expect(provider.snapshot).not.toHaveBeenCalled();
    expect(cache.status().paused).toEqual({
      until: fullBudget.resetAt,
      reason: "budget",
    });
    later(30 * minute);
    await cache.refresh();
    expect(provider.snapshot).not.toHaveBeenCalled();
    later(30 * minute);
    await cache.refresh();
    expect(provider.snapshot).toHaveBeenCalledTimes(1);
    expect(cache.status().paused).toBeUndefined();
  });

  it("runs only the free checks below the floor: data a check finds unchanged is synced, a change waits for the reset", async () => {
    const docs = "example-org/example-docs";
    let remaining = fullBudget.remaining;
    const probe = vi.fn(async (name: string, tag: string | undefined) => ({
      changed: tag === undefined || name === docs,
      tag: `"${name}"`,
    }));
    const provider = counting({
      probe,
      snapshot: vi.fn(async () => ({
        threads: [thread({ kind: "pullRequest", checks: "running" })],
        cursor: null,
      })),
      budget: () => ({ graphql: { ...fullBudget, remaining } }),
      refreshVolatile: vi.fn(async () => []),
    });
    const cache = createCache({
      provider,
      repos: [repo, docs],
      directory,
      now: () => clock,
    });
    await cache.refresh();
    const synced = clock;
    remaining = 999;
    later(2 * minute);
    await cache.refresh();
    expect(provider.snapshot).toHaveBeenCalledTimes(2);
    expect(provider.refreshVolatile).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenLastCalledWith(docs, `"${docs}"`);
    expect(cache.status()).toMatchObject({
      syncedAt: synced,
      paused: { until: fullBudget.resetAt, reason: "budget" },
    });
    later(2 * minute);
    await cache.refresh();
    expect(probe).toHaveBeenCalledTimes(6);
    expect(provider.snapshot).toHaveBeenCalledTimes(2);
  });

  it("pauses until the budget resets when the provider refuses for its rate limit", async () => {
    const cache = open(
      counting({ snapshot: failing(providerError("GITHUB_RATE_LIMITED")) }),
    );
    await cache.refresh();
    expect(cache.status()).toMatchObject({
      paused: { until: fullBudget.resetAt, reason: "rateLimit" },
      failure: undefined,
      refreshing: false,
    });
  });

  it("asks nothing, not even the free checks, while the provider refuses for its rate limit", async () => {
    const probe = vi.fn(async () => ({ changed: true, tag: undefined }));
    const snapshot = failing(providerError("GITHUB_RATE_LIMITED"));
    const cache = open(counting({ snapshot, probe }));
    await cache.refresh();
    later(30 * minute);
    await cache.refresh();
    expect(snapshot).toHaveBeenCalledOnce();
    expect(probe).toHaveBeenCalledOnce();
  });

  it("keeps the rate limit as the failure when no budget is known", async () => {
    const error = providerError("GITHUB_RATE_LIMITED");
    const cache = open(
      counting({ snapshot: failing(error), budget: () => ({}) }),
    );
    await cache.refresh();
    expect(cache.status()).toMatchObject({ paused: undefined, failure: error });
  });

  it("keeps the threads, and says why, when a refresh fails", async () => {
    const error = providerError("GITHUB_REQUEST_FAILED");
    const snapshot = vi.fn(async () => ({ threads: [thread()], cursor: null }));
    const cache = open(counting({ snapshot }));
    await cache.refresh();
    const synced = clock;
    snapshot.mockRejectedValueOnce(error);
    later(2 * minute);
    await cache.refresh();
    expect(cache.threads()).toEqual({ threads: [thread()], syncedAt: synced });
    expect(cache.status().failure).toBe(error);
    later(2 * minute);
    await cache.refresh();
    expect(cache.status().failure).toBeUndefined();
  });

  it("keeps a wait for another process's fetch that runs out in the status", async () => {
    // Another process holds the fetch lock and keeps touching it.
    const held = join(directory, "fetch.lock");
    await mkdir(held, { recursive: true });
    const touched = new Date(Date.now() + 3_600_000);
    await utimes(held, touched, touched);
    const provider = counting();
    const cache = open(provider);
    vi.useFakeTimers({ toFake: ["Date"] });
    const refreshing = cache.refresh();
    await new Promise((resolve) => setTimeout(resolve, 300));
    vi.setSystemTime(Date.now() + 120_000);
    await refreshing;
    expect(cache.status().failure).toMatchObject({
      code: "CACHE_LOCK_TIMED_OUT",
    });
    expect(provider.snapshot).not.toHaveBeenCalled();
  });

  it("keeps any other failure in the status, with a recovery step, and syncs at the next step", async () => {
    const snapshot = vi.fn(async () => ({ threads: [thread()], cursor: null }));
    snapshot.mockRejectedValueOnce(new Error("The operation timed out."));
    const cache = open(counting({ snapshot }));
    await cache.refresh();
    expect(cache.status().failure).toMatchObject({
      code: "CACHE_REFRESH_FAILED",
      message: "docket could not refresh its cache: The operation timed out.",
      recovery: "refresh again",
    });
    await cache.refresh();
    expect(cache.threads().threads).toEqual([thread()]);
    expect(cache.status().failure).toBeUndefined();
  });

  it("names a failure that is not an error by its value, ending with a full stop", async () => {
    const snapshot = vi.fn(async () => ({ threads: [thread()], cursor: null }));
    snapshot.mockRejectedValueOnce("no answer");
    const cache = open(counting({ snapshot }));
    await cache.refresh();
    expect(cache.status().failure).toMatchObject({
      code: "CACHE_REFRESH_FAILED",
      message: "docket could not refresh its cache: no answer.",
    });
  });

  it.each([
    ["a question mark", "Bad credentials?"],
    ["an exclamation mark", "Gone!"],
  ])("adds no full stop to a cause that ends in %s", async (_, cause) => {
    const snapshot = vi.fn(async () => ({
      threads: [thread()],
      cursor: null,
    }));
    snapshot.mockRejectedValueOnce(new Error(cause));
    const cache = open(counting({ snapshot }));
    await cache.refresh();
    expect(cache.status().failure).toMatchObject({
      message: `docket could not refresh its cache: ${cause}`,
    });
  });

  it("says only that the refresh failed when the cause has no text", async () => {
    const snapshot = vi.fn(async () => ({ threads: [thread()], cursor: null }));
    snapshot.mockRejectedValueOnce(new Error(""));
    const cache = open(counting({ snapshot }));
    await cache.refresh();
    expect(cache.status().failure).toMatchObject({
      code: "CACHE_REFRESH_FAILED",
      message: "docket could not refresh its cache.",
    });
  });
});

describe("the watch of createCache", () => {
  it("reloads what another process writes, until it stops watching", async () => {
    const cache = open(counting());
    const stop = cache.watch();
    await open(counting()).read(5 * minute);
    await waitUntil(() => {
      expect(cache.threads().threads).toEqual([thread()]);
    });
    stop();
    later(10 * minute);
    await open(
      counting({
        snapshot: async () => ({ threads: [], cursor: null }),
      }),
    ).read(5 * minute);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(cache.threads().threads).toEqual([thread()]);
  });
});
