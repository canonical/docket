import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Cache, CachedEvents } from "../lib/cache/index.js";
import { holdCache, settleStatus } from "../testing/cache.js";
import { everyCapability, providerError } from "../testing/provider.js";
import {
  parserFixDetail,
  recordedEvents,
  recordedNow,
  recordedSettings,
  recordedThreads,
  recordedWatched,
} from "../testing/recorded.js";
import { draw } from "../testing/terminal.js";
import { waitUntil } from "../testing/wait.js";
import type { TerminalView, Watched } from "./types.js";
import useWindowList, {
  type ReadHeld,
  type UseWindowListProps,
} from "./useWindowList.js";

const [day] = recordedSettings.activity;

/** Reads each repository and gives how many events each holds. */
const countEvents = async (read: ReadHeld, watched: readonly Watched[]) =>
  Promise.all(
    watched.map(
      async ({ repo }) => (await read(repo, new Date(0))).events.length,
    ),
  );

type Props = UseWindowListProps<number[], string>;

/**
 * Draws what the hook gives on one line: the list, the code of what
 * failed, if anything did, and when the
 * oldest data it was built from was fetched; the code of its problem; or
 * `reading`.
 *
 * @param readEvents The source's reading of a repository's events.
 * @param cache The cache the source reads through.
 */
async function probe(
  readEvents: (repo: string, since: Date) => Promise<CachedEvents>,
  overrides: Partial<Props> = {},
  cache: Cache = holdCache(
    { threads: recordedThreads, syncedAt: recordedNow },
    settleStatus(recordedNow),
    recordedEvents,
  ),
) {
  const source: TerminalView["source"] = {
    cache,
    capabilities: everyCapability,
    readWatched: async () => ({ watched: recordedWatched() }),
    readViewer: async () => "alice",
    readDetail: async () => parserFixDetail,
    readCandidates: () => Promise.reject(new Error("no editor opens")),
    write: () => Promise.reject(new Error("no editor opens")),
    readEvents,
    readInbox: () => cache.readNotifications(300_000),
    refreshInbox: () => cache.refreshNotifications(),
    markNotificationRead: async (id) => cache.setNotificationRead(id),
  };
  let setNext: (props: Partial<Props>) => void = () => {};
  function Probe() {
    const [props, setProps] = useState<Props>({
      source,
      threads: recordedThreads,
      syncedAt: recordedNow,
      shown: true,
      watched: recordedWatched(),
      window: day,
      now: () => recordedNow,
      time: countEvents,
      build: (counts, threads) => `${counts.join("/")} of ${threads.length}`,
      ...overrides,
    });
    setNext = (next) => setProps((current) => ({ ...current, ...next }));
    const result = useWindowList(props);
    if (!result) return <text>reading</text>;
    if ("problem" in result) return <text>{result.problem.code}</text>;
    const parts = [
      result.list,
      ...(result.partial ? ["partial"] : []),
      ...(result.failure ? [result.failure.code] : []),
    ];
    return (
      <text>{`${parts.join(" · ")} · read ${result.readAt?.toISOString() ?? "-"}`}</text>
    );
  }
  const screen = await draw(<Probe />, 60, 1);
  return {
    change: (next: Partial<Props>) => screen.redraw(() => setNext(next)),
    read: async () => (await screen.redraw()).lines.at(0),
  };
}

const timedOut = providerError("GITHUB_TIMED_OUT");

/** A cache below the budget floor that holds nothing for any window. */
const flooredEmpty = (): Cache => ({
  ...holdCache(
    { threads: recordedThreads, syncedAt: recordedNow },
    settleStatus(recordedNow),
  ),
  maySpend: () => false,
  findEvents: () => undefined,
});

/** A cache whose events were fetched half an hour ago. */
const aged = (): Cache =>
  holdCache(
    { threads: recordedThreads, syncedAt: recordedNow },
    {
      ...settleStatus(recordedNow),
      syncedAt: new Date(recordedNow.getTime() - 30 * 60_000),
    },
    recordedEvents,
  );

describe("useWindowList", () => {
  it("builds the list from each repository read through the source, with the threads", async () => {
    const read = async (repo: string) => ({
      events: recordedEvents.filter(({ thread }) => thread.repo === repo),
      finished: [],
      syncedAt: recordedNow,
    });
    expect(await (await probe(read)).read()).toBe(
      `3/1 of 3 · read ${recordedNow.toISOString()}`,
    );
  });

  it("reads the window while hidden and builds its list when shown", async () => {
    let reads = 0;
    const { read, change } = await probe(
      async (repo: string) => {
        reads += 1;
        return {
          events: recordedEvents.filter(({ thread }) => thread.repo === repo),
          finished: [],
          syncedAt: recordedNow,
        };
      },
      { shown: false },
    );
    expect(await read()).toBe("reading");
    expect(reads).toBe(2);
    await change({ shown: true });
    expect(await read()).toBe(`3/1 of 3 · read ${recordedNow.toISOString()}`);
  });

  it("reads nothing while no threads are in", async () => {
    let reads = 0;
    const { read } = await probe(
      async () => {
        reads += 1;
        throw timedOut;
      },
      { threads: undefined },
    );
    expect(await read()).toBe("reading");
    expect(reads).toBe(0);
  });

  it("builds an empty list when there are no repositories to watch", async () => {
    const { read } = await probe(() => new Promise(() => {}), { watched: [] });
    expect(await read()).toBe(" of 3 · read -");
  });

  it("keeps the fresh answer when timing the cached snapshot fails", async () => {
    let attempts = 0;
    const time: Props["time"] = async (read, watched) => {
      attempts += 1;
      if (attempts === 1) throw new Error("cannot time the snapshot");
      return countEvents(read, watched);
    };
    const { read } = await probe(
      async () => ({
        events: [],
        finished: [],
        syncedAt: recordedNow,
      }),
      { time },
    );
    await waitUntil(async () =>
      expect(await read()).toBe(`0/0 of 3 · read ${recordedNow.toISOString()}`),
    );
  });

  it("keeps the fresh answer when timing the cached snapshot finishes later", async () => {
    const snapshot = Promise.withResolvers<number[]>();
    let attempts = 0;
    const time: Props["time"] = async (read, watched) => {
      attempts += 1;
      if (attempts === 1) return snapshot.promise;
      return countEvents(read, watched);
    };
    const { read } = await probe(
      async () => ({ events: [], finished: [], syncedAt: recordedNow }),
      { time },
    );
    await waitUntil(async () =>
      expect(await read()).toBe(`0/0 of 3 · read ${recordedNow.toISOString()}`),
    );
    snapshot.resolve([3, 1]);
    expect(await read()).toBe(`0/0 of 3 · read ${recordedNow.toISOString()}`);
  });

  it("ignores a cached snapshot when its window changes before it finishes", async () => {
    const snapshot = Promise.withResolvers<number[]>();
    const wider = recordedSettings.activity[1];
    const time: Props["time"] = async (_read, _watched, window) =>
      window === day ? snapshot.promise : [4];
    const { change, read } = await probe(() => new Promise(() => {}), { time });
    await change({ window: wider });
    snapshot.resolve([3, 1]);
    expect(await read()).toBe(`4 of 3 · read -`);
  });

  it("keeps an in-flight background read when its mode is shown", async () => {
    const gate = Promise.withResolvers<CachedEvents>();
    let reads = 0;
    const cache: Cache = { ...aged(), findEvents: () => undefined };
    const { change, read } = await probe(
      () => {
        reads += 1;
        return gate.promise;
      },
      { shown: false },
      cache,
    );
    expect(reads).toBe(2);
    await change({ shown: true });
    expect(reads).toBe(2);
    gate.resolve({ events: [], finished: [], syncedAt: recordedNow });
    await waitUntil(async () =>
      expect(await read()).toBe(`0/0 of 3 · read ${recordedNow.toISOString()}`),
    );
  });

  it("does not start another repository after the pane becomes idle", async () => {
    const first = Promise.withResolvers<CachedEvents>();
    let reads = 0;
    const cache: Cache = { ...aged(), findEvents: () => undefined };
    const time: Props["time"] = async (read, watched) => {
      const counts: number[] = [];
      for (const { repo } of watched) {
        counts.push((await read(repo, new Date(0))).events.length);
      }
      return counts;
    };
    const { change } = await probe(
      () => {
        reads += 1;
        return first.promise;
      },
      { shown: false, time },
      cache,
    );
    expect(reads).toBe(1);
    await change({ attention: "idle" });
    first.resolve({ events: [], finished: [], syncedAt: recordedNow });
    await change({ attention: "idle" });
    expect(reads).toBe(1);
  });

  it("serves what the cache holds for the window at once, and the read that follows replaces it", async () => {
    const gate = Promise.withResolvers<CachedEvents>();
    const { read } = await probe(() => gate.promise, {}, aged());
    // The held events serve without one request, however old, while the
    // read that follows is under way.
    expect(await read()).toBe(
      `3/1 of 3 · read ${new Date(recordedNow.getTime() - 30 * 60_000).toISOString()}`,
    );
    gate.resolve({ events: [], finished: [], syncedAt: recordedNow });
    await waitUntil(async () =>
      expect(await read()).toBe(`0/0 of 3 · read ${recordedNow.toISOString()}`),
    );
  });

  it("serves the events held below the budget floor, however old, without a read", async () => {
    const cache: Cache = { ...aged(), maySpend: () => false };
    const { read } = await probe(
      async () => {
        throw timedOut;
      },
      {},
      cache,
    );
    expect(await read()).toBe(
      `3/1 of 3 · read ${new Date(recordedNow.getTime() - 30 * 60_000).toISOString()}`,
    );
  });

  it("gives nothing while the cache holds nothing for the window and the read is under way", async () => {
    const empty: Cache = {
      ...holdCache(
        { threads: recordedThreads, syncedAt: recordedNow },
        settleStatus(recordedNow),
        recordedEvents,
      ),
      findEvents: () => undefined,
    };
    const { read } = await probe(() => new Promise(() => {}), {}, empty);
    expect(await read()).toBe("reading");
  });

  it("serves covered repositories and marks the result partial while another is read", async () => {
    const held = aged();
    const cache: Cache = {
      ...held,
      findEvents: (repo, since) =>
        repo === recordedWatched()[0]?.repo
          ? held.findEvents(repo, since)
          : undefined,
    };
    const { read } = await probe(() => new Promise(() => {}), {}, cache);
    expect(await read()).toContain("3/0 of 3 · partial");
  });

  it("answers from what the cache holds when a repository's read fails, naming the failure", async () => {
    const { read } = await probe(async () => {
      throw timedOut;
    });
    expect(await read()).toBe(
      `3/1 of 3 · GITHUB_TIMED_OUT · read ${new Date(recordedNow.getTime() - 120_000).toISOString()}`,
    );
  });

  it("reads the window again at a sync, keeping the list it holds while the read is under way", async () => {
    const gate = Promise.withResolvers<CachedEvents>();
    const later = new Date(recordedNow.getTime() + 180_000);
    const { change, read } = await probe(() => gate.promise, {}, aged());
    await read();
    await change({ syncedAt: later });
    // The held list stays while the read for the window is under way,
    // and its data's age with it.
    expect(await read()).toBe(
      `3/1 of 3 · read ${new Date(recordedNow.getTime() - 30 * 60_000).toISOString()}`,
    );
    gate.resolve({ events: [], finished: [], syncedAt: recordedNow });
    await waitUntil(async () => expect(await read()).toContain("0/0 of 3"));
  });

  it("below the budget floor, a window held nothing of waits off screen, and the mode on screen reads it", async () => {
    let reads = 0;
    const reading = () => {
      reads += 1;
      throw timedOut;
    };
    const hidden = await probe(reading, { shown: false }, flooredEmpty());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await hidden.read()).toBe("reading");
    expect(reads).toBe(0);
    const shown = await probe(reading, {}, flooredEmpty());
    await waitUntil(async () =>
      expect(await shown.read()).toBe("GITHUB_TIMED_OUT"),
    );
    expect(reads).toBe(2);
  });

  it("below the budget floor, what the cache holds answers, off screen as on", async () => {
    let reads = 0;
    const cache: Cache = {
      ...holdCache(
        { threads: recordedThreads, syncedAt: recordedNow },
        settleStatus(recordedNow),
        recordedEvents,
      ),
      maySpend: () => false,
    };
    const { read, change } = await probe(
      async () => {
        reads += 1;
        throw timedOut;
      },
      { shown: false },
      cache,
    );
    await change({ shown: true });
    expect(await read()).toBe(
      `3/1 of 3 · read ${new Date(recordedNow.getTime() - 120_000).toISOString()}`,
    );
    expect(reads).toBe(0);
  });

  it("reads no window again while the pane is idle, and the list it holds stays", async () => {
    let reads = 0;
    const reading = async (repo: string) => {
      reads += 1;
      return {
        events: recordedEvents.filter(({ thread }) => thread.repo === repo),
        finished: [],
        syncedAt: recordedNow,
      };
    };
    const idle = await probe(reading, { attention: "idle" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await idle.read()).toBe("reading");
    expect(reads).toBe(0);
    const { change, read } = await probe(reading);
    expect(await read()).toBe(`3/1 of 3 · read ${recordedNow.toISOString()}`);
    const held = reads;
    await change({
      attention: "idle",
      syncedAt: new Date(recordedNow.getTime() + 180_000),
    });
    expect(await read()).toBe(`3/1 of 3 · read ${recordedNow.toISOString()}`);
    expect(reads).toBe(held);
  });

  it("gives a failure no code names as the problem, in place of the list", async () => {
    const { read } = await probe(async () => {
      throw new Error("the disk is gone");
    });
    expect(await read()).toBe("UNEXPECTED_FAILURE");
  });
});
