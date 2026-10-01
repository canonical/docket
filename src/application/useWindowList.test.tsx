import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { CachedEvents } from "../lib/cache/index.js";
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
import type { TerminalView, Watched } from "./types.js";
import useWindowList, {
  type ReadHeld,
  type UseWindowListProps,
} from "./useWindowList.js";

const [day, twoDays] = recordedSettings.activity;

/** Reads each repository and gives how many events each holds. */
const countEvents = async (read: ReadHeld, watched: readonly Watched[]) =>
  Promise.all(
    watched.map(
      async ({ repo }) => (await read(repo, new Date(0))).events.length,
    ),
  );

type Props = UseWindowListProps<number[], string>;

/**
 * Draws what the hook gives on one line: the list, then the code of what
 * failed, if anything did; the code of its problem; or `reading`.
 *
 * @param readEvents The source's reading of a repository's events.
 */
async function probe(
  readEvents: (repo: string, since: Date) => Promise<CachedEvents>,
  overrides: Partial<Props> = {},
) {
  const cache = holdCache(
    { threads: recordedThreads, syncedAt: recordedNow },
    settleStatus(recordedNow),
    recordedEvents,
  );
  const source: TerminalView["source"] = {
    cache,
    capabilities: everyCapability,
    readWatched: async () => ({ watched: recordedWatched() }),
    readViewer: async () => "alice",
    readDetail: async () => parserFixDetail,
    readCandidates: () => Promise.reject(new Error("no editor opens")),
    write: () => Promise.reject(new Error("no editor opens")),
    readEvents,
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
    const failed = result.failure ? ` · ${result.failure.code}` : "";
    return <text>{`${result.list}${failed}`}</text>;
  }
  const screen = await draw(<Probe />, 60, 1);
  return {
    change: (next: Partial<Props>) => screen.redraw(() => setNext(next)),
    read: async () => (await screen.redraw()).lines.at(0),
  };
}

const timedOut = providerError("GITHUB_TIMED_OUT");

describe("useWindowList", () => {
  it("builds the list from each repository read through the source, with the threads", async () => {
    const read = async (repo: string) => ({
      events: recordedEvents.filter(({ thread }) => thread.repo === repo),
      finished: [],
      syncedAt: recordedNow,
    });
    expect(await (await probe(read)).read()).toBe("3/1 of 3");
  });

  it("reads nothing while the mode is not shown, and gives nothing", async () => {
    let reads = 0;
    const { read } = await probe(
      async () => {
        reads += 1;
        throw timedOut;
      },
      { shown: false },
    );
    expect(await read()).toBe("reading");
    expect(reads).toBe(0);
  });

  it("answers from what the cache holds when a repository's read fails, naming the failure", async () => {
    const { read } = await probe(async () => {
      throw timedOut;
    });
    expect(await read()).toBe("3/1 of 3 · GITHUB_TIMED_OUT");
  });

  it("gives nothing for a window it has not read yet", async () => {
    const { change, read } = await probe(() => new Promise(() => {}), {
      time: async () => [1],
    });
    expect(await read()).toBe("1 of 3");
    await change({ window: twoDays, time: () => new Promise(() => {}) });
    expect(await read()).toBe("reading");
  });

  it("gives a failure no code names as the problem, in place of the list", async () => {
    const { read } = await probe(async () => {
      throw new Error("the disk is gone");
    });
    expect(await read()).toBe("UNEXPECTED_FAILURE");
  });
});
