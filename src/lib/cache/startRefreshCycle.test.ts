import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeProvider } from "../../testing/provider.js";
import { waitUntil } from "../../testing/wait.js";
import createAttention from "./createAttention.js";
import createCache from "./createCache.js";
import startRefreshCycle from "./startRefreshCycle.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const second = 1_000;
const minute = 60 * second;

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
    startRefreshCycle(cache, createAttention());
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
    startRefreshCycle(cache, createAttention());
    await vi.advanceTimersByTimeAsync(149 * second);
    expect(cache.refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1 * second);
    expect(cache.refresh).toHaveBeenCalledTimes(2);
  });

  it("refreshes no more and stops watching once stopped", async () => {
    const cache = fakeCache();
    const stop = startRefreshCycle(cache, createAttention());
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(600 * second);
    expect(cache.refresh).toHaveBeenCalledTimes(1);
    expect(cache.stopWatching).toHaveBeenCalled();
  });

  it("schedules nothing after a refresh that ends once stopped", async () => {
    const cache = fakeCache(30 * second);
    const stop = startRefreshCycle(cache, createAttention());
    await vi.advanceTimersByTimeAsync(10 * second);
    stop();
    await vi.advanceTimersByTimeAsync(600 * second);
    expect(cache.refresh).toHaveBeenCalledTimes(1);
  });

  it("backs off to every 30 minutes once the pane is idle, refreshing as idle", async () => {
    const cache = fakeCache();
    startRefreshCycle(cache, createAttention());
    await vi.advanceTimersByTimeAsync(19 * minute);
    expect(cache.refresh).toHaveBeenCalledTimes(10);
    expect(cache.refresh).toHaveBeenLastCalledWith("active");
    await vi.advanceTimersByTimeAsync(4 * minute);
    expect(cache.refresh).toHaveBeenLastCalledWith("idle");
    const idle = cache.refresh.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30 * minute);
    expect(cache.refresh).toHaveBeenCalledTimes(idle + 1);
    await vi.advanceTimersByTimeAsync(30 * minute);
    expect(cache.refresh).toHaveBeenCalledTimes(idle + 2);
  });

  it("refreshes at once when a key wakes the pane, then settles it active on the 120-second cycle", async () => {
    const cache = fakeCache();
    const attention = createAttention();
    startRefreshCycle(cache, attention);
    await vi.advanceTimersByTimeAsync(25 * minute);
    const before = cache.refresh.mock.calls.length;
    attention.press();
    await vi.advanceTimersByTimeAsync(0);
    expect(cache.refresh).toHaveBeenCalledTimes(before + 1);
    expect(cache.refresh).toHaveBeenLastCalledWith("waking");
    expect(attention.state()).toBe("active");
    await vi.advanceTimersByTimeAsync(2 * minute);
    expect(cache.refresh).toHaveBeenCalledTimes(before + 2);
    expect(cache.refresh).toHaveBeenLastCalledWith("active");
  });

  it("catches up as soon as a refresh under way ends when a key wakes the pane during it", async () => {
    const finish: (() => void)[] = [];
    const cache = {
      refresh: vi.fn(
        () => new Promise<void>((resolve) => finish.push(resolve)),
      ),
      watch: () => () => {},
    };
    const attention = createAttention();
    vi.advanceTimersByTime(20 * minute);
    startRefreshCycle(cache, attention);
    expect(cache.refresh).toHaveBeenLastCalledWith("idle");
    attention.press();
    await vi.advanceTimersByTimeAsync(0);
    expect(cache.refresh).toHaveBeenCalledOnce();
    finish.shift()?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(cache.refresh).toHaveBeenCalledTimes(2);
    expect(cache.refresh).toHaveBeenLastCalledWith("waking");
    finish.shift()?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(attention.state()).toBe("active");
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
    const stop = startRefreshCycle(cache, createAttention());
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
