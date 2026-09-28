import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type Cache,
  type CachedEvents,
  createCache,
} from "../lib/cache/index.js";
import { everyCapability, providerError } from "../testing/provider.js";
import {
  parserFixDetail,
  recordedNow,
  recordedProvider,
  recordedRepos,
  recordedSettings,
  recordedThreads,
  recordedWatched,
} from "../testing/recorded.js";
import { draw } from "../testing/terminal.js";
import type { TerminalView } from "./types.js";
import useActivity, { type UseActivityProps } from "./useActivity.js";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) {
    await rm(folder, { recursive: true, force: true });
  }
});

const [day, twoDays] = recordedSettings.activity;
const later = new Date(recordedNow.getTime() + 3_600_000);

/** A cache of the recording in a folder of its own. */
async function openCache() {
  const directory = await mkdtemp(join(tmpdir(), "docket-activity-"));
  folders.push(directory);
  return createCache({
    provider: recordedProvider(),
    repos: recordedRepos.map(({ repo }) => repo),
    directory,
    now: () => recordedNow,
  });
}

type Reader = (repo: string, since: Date) => Promise<CachedEvents>;

/** Reads through `cache`, as the terminal does, at the default maximum age. */
const throughCache =
  (cache: Cache): Reader =>
  (repo, since) =>
    cache.readEvents(repo, since, 300_000);

/**
 * Draws what the hook gives, one line: the list's summary and the age of
 * its newest thread, the code of its problem, or `reading` while it has
 * nothing. `change` sets new props, as the screen would.
 *
 * @param makeReader Makes the source's reading of events from its cache.
 */
async function probe(
  makeReader: (cache: Cache) => Reader,
  overrides: Partial<UseActivityProps> = {},
) {
  const cache = await openCache();
  const source: TerminalView["source"] = {
    cache,
    capabilities: everyCapability,
    readWatched: async () => ({ watched: recordedWatched() }),
    readDetail: async () => parserFixDetail,
    readEvents: makeReader(cache),
  };
  let setNext: (props: Partial<UseActivityProps>) => void = () => {};
  function Probe() {
    const [props, setProps] = useState<UseActivityProps>({
      source,
      threads: recordedThreads,
      syncedAt: recordedNow,
      shown: true,
      watched: recordedWatched(),
      window: day,
      grouping: "none",
      now: () => recordedNow,
      at: recordedNow,
      ...overrides,
    });
    setNext = (next) => setProps((current) => ({ ...current, ...next }));
    const result = useActivity(props);
    if (!result) return <text>reading</text>;
    if ("problem" in result) return <text>{result.problem.code}</text>;
    const { summary, groups } = result.list;
    const age = groups.at(0)?.rows.at(0)?.distance.text ?? "-";
    return <text>{`${summary.text} · ${age}`}</text>;
  }
  const screen = await draw(<Probe />, 40, 1);
  return {
    change: (next: Partial<UseActivityProps>) =>
      screen.redraw(() => setNext(next)),
    read: async () => (await screen.redraw()).lines.at(0),
  };
}

describe("useActivity", () => {
  it("builds the list from the events read through the cache for the window", async () => {
    const reads: string[] = [];
    const { read } = await probe((cache) => (repo, since) => {
      reads.push(repo);
      return throughCache(cache)(repo, since);
    });
    await vi.waitFor(async () =>
      expect(await read()).toBe("2 threads · 3 events · 25m"),
    );
    expect(reads).toEqual([
      "example-org/example-repo",
      "example-org/example-docs",
    ]);
  });

  it("reads nothing while activity is not shown or no threads are in", async () => {
    const reader = vi.fn(() => new Promise<CachedEvents>(() => {}));
    const hidden = await probe(() => reader, { shown: false });
    expect(await hidden.read()).toBe("reading");
    const empty = await probe(() => reader, { threads: undefined });
    expect(await empty.read()).toBe("reading");
    expect(reader).not.toHaveBeenCalled();
  });

  it("moves the ages with the clock without reading again", async () => {
    let reads = 0;
    const { change, read } = await probe((cache) => (repo, since) => {
      reads += 1;
      return throughCache(cache)(repo, since);
    });
    await vi.waitFor(async () => expect(await read()).toMatch(/25m$/));
    await change({ at: later });
    expect(await read()).toBe("2 threads · 3 events · 1h");
    expect(reads).toBe(2);
  });

  it("reads again at each sync, and shows nothing for a new window until its events are in", async () => {
    let reads = 0;
    let wait: Promise<CachedEvents> | undefined;
    const { change, read } = await probe((cache) => (repo, since) => {
      reads += 1;
      return wait ?? throughCache(cache)(repo, since);
    });
    await vi.waitFor(async () => expect(await read()).toMatch(/^2 threads/));
    await change({ syncedAt: later });
    await vi.waitFor(() => expect(reads).toBe(4));
    const { promise, resolve } = Promise.withResolvers<CachedEvents>();
    wait = promise;
    await change({ window: twoDays });
    expect(await read()).toBe("reading");
    resolve({ events: [], syncedAt: recordedNow });
    await vi.waitFor(async () =>
      expect(await read()).toBe("0 threads · 0 events · -"),
    );
  });

  it("drops a reading the screen moved on from before it ended", async () => {
    const first = Promise.withResolvers<CachedEvents>();
    const second = Promise.withResolvers<CachedEvents>();
    const reader = vi
      .fn<Reader>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockResolvedValue({ events: [], syncedAt: recordedNow });
    const { change, read } = await probe(() => reader, {
      watched: recordedWatched().slice(0, 1),
    });
    await change({ window: twoDays });
    first.resolve({ events: [], syncedAt: recordedNow });
    expect(await read()).toBe("reading");
    await change({ window: day });
    second.reject(new Error("GitHub gave no answer"));
    await vi.waitFor(async () =>
      expect(await read()).toBe("0 threads · 0 events · -"),
    );
    expect(reader).toHaveBeenCalledTimes(3);
  });

  it("answers from the events the cache holds when reading them fails", async () => {
    let failing = false;
    const { change, read } = await probe((cache) => (repo, since) => {
      if (failing) return Promise.reject(providerError("GITHUB_TIMED_OUT"));
      return throughCache(cache)(repo, since);
    });
    await vi.waitFor(async () => expect(await read()).toMatch(/^2 threads/));
    failing = true;
    await change({ syncedAt: later, at: later });
    await vi.waitFor(async () =>
      expect(await read()).toBe("2 threads · 3 events · 1h"),
    );
  });

  it("gives the failure when the cache holds no events for the window", async () => {
    const { read } = await probe(
      () => () => Promise.reject(providerError("GITHUB_TIMED_OUT")),
    );
    await vi.waitFor(async () => expect(await read()).toBe("GITHUB_TIMED_OUT"));
  });
});
