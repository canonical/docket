import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Cache, CachedNotifications } from "../lib/cache/index.js";
import type { PageProgress } from "../lib/provider/index.js";
import { recordedNotifications } from "../testing/inbox.js";
import {
  everyCapability,
  fakeProvider,
  providerError,
} from "../testing/provider.js";
import { recordedWatched } from "../testing/recorded.js";
import { draw } from "../testing/terminal.js";
import { waitUntil } from "../testing/wait.js";
import type { TerminalView } from "./types.js";
import useInbox from "./useInbox.js";

const watched = recordedWatched();

let setShown: (shown: boolean) => void = () => {};

function probe(
  readInbox: (
    onPage?: (progress: PageProgress) => void,
  ) => Promise<CachedNotifications>,
  notifications?: CachedNotifications,
) {
  const cache = {
    ...fakeProvider(),
    subscribe: () => () => {},
    notifications: () => notifications,
  } as unknown as Cache;
  const source = {
    cache,
    capabilities: everyCapability,
    readWatched: async () => ({ watched }),
    readViewer: async () => "alice",
    readDetail: async () => Promise.reject(new Error("unused")),
    readCandidates: async () => ({ current: [], offered: [] }),
    write: async () => ({ current: [] }),
    readEvents: async () => ({
      events: [],
      finished: [],
      syncedAt: new Date(),
    }),
    readInbox,
    refreshInbox: async () => {},
    markNotificationRead: async () => {},
  } satisfies TerminalView["source"];
  function Probe() {
    const [shown, set] = useState(true);
    setShown = set;
    const result = useInbox({
      source,
      shown,
      attention: "active",
      syncedAt: undefined,
      watched,
      grouping: "repo",
      filter: "unread",
      now: () => new Date("2026-09-28T10:00:00Z"),
      at: new Date("2026-09-28T10:00:00Z"),
    });
    return (
      <text>
        {result.problem
          ? result.problem.code
          : result.list
            ? `${result.list.counts.unread}${result.failure ? ` ${result.failure.code}` : ""}`
            : result.reading
              ? `reading${result.progress ? ` ${result.progress.fetched}/${result.progress.total}` : ""}`
              : "waiting"}
      </text>
    );
  }
  return draw(<Probe />, 40, 1);
}

describe("useInbox", () => {
  it("stands the failure in place of the list when nothing is held", async () => {
    const readInbox = vi.fn(async () => {
      throw providerError("GITHUB_TIMED_OUT");
    });
    const screen = await probe(readInbox);
    await waitUntil(async () =>
      expect((await screen.redraw()).lines.at(0)).toBe("GITHUB_TIMED_OUT"),
    );
    expect(readInbox).toHaveBeenCalledOnce();
  });

  it("reports the pages of a read under way", async () => {
    const gate = Promise.withResolvers<CachedNotifications>();
    const readInbox = vi.fn((onPage?: (progress: PageProgress) => void) => {
      onPage?.({ fetched: 1, total: 3 });
      return gate.promise;
    });
    const screen = await probe(readInbox);
    await waitUntil(async () =>
      expect((await screen.redraw()).lines.at(0)).toBe("reading 1/3"),
    );
    gate.resolve({
      items: recordedNotifications,
      syncedAt: new Date("2026-09-28T09:58:00Z"),
    });
  });

  it("keeps the cached rows and carries the failure when a read fails", async () => {
    const readInbox = vi.fn(async () => {
      throw providerError("GITHUB_TIMED_OUT");
    });
    const screen = await probe(readInbox, {
      items: recordedNotifications,
      syncedAt: new Date("2026-09-28T09:58:00Z"),
    });
    await waitUntil(async () =>
      expect((await screen.redraw()).lines.at(0)).toBe("4 GITHUB_TIMED_OUT"),
    );
  });

  it("ignores a failure that arrives after the mode closes", async () => {
    const gate = Promise.withResolvers<never>();
    const screen = await probe(() => gate.promise);
    await screen.redraw(() => setShown(false));
    gate.reject(providerError("GITHUB_TIMED_OUT"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await screen.redraw()).lines.at(0)).toBe("reading");
  });

  it("rethrows a defect that is not a named failure", async () => {
    const seen = Promise.withResolvers<unknown>();
    const listener = (reason: unknown) => seen.resolve(reason);
    process.on("unhandledRejection", listener);
    try {
      await probe(async () => {
        throw new Error("a defect");
      });
      expect(await seen.promise).toBeInstanceOf(Error);
    } finally {
      process.off("unhandledRejection", listener);
    }
  });

  it("ignores a read that arrives after the mode closes", async () => {
    const gate = Promise.withResolvers<void>();
    let report: ((progress: PageProgress) => void) | undefined;
    const screen = await probe((onPage) => {
      report = onPage;
      return gate.promise as Promise<never>;
    });
    await screen.redraw(() => setShown(false));
    report?.({ fetched: 1, total: 3 });
    gate.resolve();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await screen.redraw()).lines.at(0)).toBe("reading");
  });
});
