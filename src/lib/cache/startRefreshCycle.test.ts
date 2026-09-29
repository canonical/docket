import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeProvider } from "../../testing/provider.js";
import { waitUntil } from "../../testing/wait.js";
import createCache from "./createCache.js";
import startRefreshCycle from "./startRefreshCycle.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const second = 1_000;

/** A cache whose refresh takes `duration` milliseconds. */
function fakeCache(duration = 0) {
  const stopWatching = vi.fn();
  return {
    refresh: vi.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, duration)),
    ),
    watch: vi.fn(() => stopWatching),
    stopWatching,
  };
}

describe("startRefreshCycle", () => {
  it("refreshes at once, then every 120 seconds, and watches the cache", async () => {
    const cache = fakeCache();
    startRefreshCycle(cache);
    await vi.advanceTimersByTimeAsync(0);
    expect(cache.refresh).toHaveBeenCalledTimes(1);
    expect(cache.watch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(119 * second);
    expect(cache.refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1 * second);
    expect(cache.refresh).toHaveBeenCalledTimes(2);
  });

  it("waits 120 seconds after a slow refresh ends before the next", async () => {
    const cache = fakeCache(30 * second);
    startRefreshCycle(cache);
    await vi.advanceTimersByTimeAsync(149 * second);
    expect(cache.refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1 * second);
    expect(cache.refresh).toHaveBeenCalledTimes(2);
  });

  it("refreshes no more and stops watching once stopped", async () => {
    const cache = fakeCache();
    const stop = startRefreshCycle(cache);
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(600 * second);
    expect(cache.refresh).toHaveBeenCalledTimes(1);
    expect(cache.stopWatching).toHaveBeenCalled();
  });

  it("schedules nothing after a refresh that ends once stopped", async () => {
    const cache = fakeCache(30 * second);
    const stop = startRefreshCycle(cache);
    await vi.advanceTimersByTimeAsync(10 * second);
    stop();
    await vi.advanceTimersByTimeAsync(600 * second);
    expect(cache.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps a refresh that fails in the status, and refreshes again 120 seconds later", async () => {
    const root = await mkdtemp(join(tmpdir(), "docket-cycle-"));
    const snapshot = vi.fn(async () => {
      throw new Error("disk full");
    });
    const cache = createCache({
      provider: fakeProvider({ snapshot }),
      repos: ["example-org/example-repo"],
      directory: join(root, "docket"),
      now: () => new Date("2026-09-28T10:00:00Z"),
    });
    const stop = startRefreshCycle(cache);
    await waitUntil(() => {
      expect(cache.status().failure).toMatchObject({
        code: "CACHE_REFRESH_FAILED",
      });
    });
    expect(snapshot).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120 * second);
    await waitUntil(() => {
      expect(snapshot).toHaveBeenCalledTimes(2);
    });
    stop();
    await rm(root, { recursive: true, force: true });
  });
});
