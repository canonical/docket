import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import {
  fakeProvider,
  fullBudget,
  providerError,
} from "../../testing/provider.js";
import type { PageProgress, Provider } from "../provider/index.js";
import createCache from "./createCache.js";

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";
const minute = 60_000;

let root: string;
let directory: string;
let clock: Date;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-stages-"));
  directory = join(root, "docket");
  clock = new Date("2026-09-28T10:00:00Z");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const open = (provider: Provider) =>
  createCache({ provider, repos: [repo, docs], directory, now: () => clock });
const later = (milliseconds: number) => {
  clock = new Date(clock.getTime() + milliseconds);
};
const snapshot = vi.fn(async (name: string) => ({
  threads: [thread({ repo: name })],
  cursor: null,
}));

describe("the stages of createCache", () => {
  it("holds no stage before the first refresh", () => {
    expect(open(fakeProvider()).status()).toMatchObject({
      whole: false,
      stages: [],
    });
  });

  it("runs a refresh with the data shown as a background one, reporting each repository's stage", async () => {
    const cache = open(fakeProvider({ snapshot }));
    await cache.refresh();
    later(2 * minute);
    const seen: unknown[] = [];
    cache.subscribe(() => {
      const { whole, stages } = cache.status();
      seen.push({ whole, repo: stages.at(0)?.stage });
    });
    await cache.refresh();
    expect(seen).toContainEqual({ whole: false, repo: { kind: "checking" } });
    expect(cache.status().stages).toEqual([
      { repo, stage: { kind: "done", threads: 1, fetched: 0, total: 0 } },
      { repo: docs, stage: { kind: "done", threads: 1, fetched: 0, total: 0 } },
    ]);
  });

  it("keeps where a failed refresh stopped: the repository it was on failed, those after it waiting", async () => {
    const error = providerError("GITHUB_REQUEST_FAILED");
    const cache = open(
      fakeProvider({
        snapshot: async (name) => {
          if (name === repo) throw error;
          return { threads: [], cursor: null };
        },
      }),
    );
    await cache.refresh();
    expect(cache.status()).toMatchObject({
      failure: error,
      refreshing: false,
      stages: [
        { repo, stage: { kind: "failed", error } },
        { repo: docs, stage: { kind: "waiting" } },
      ],
    });
  });

  it("pauses the repository a rate limit stopped on and every one after it, whatever failure the status still holds", async () => {
    const offline = providerError("GITHUB_UNREACHABLE");
    const limited = providerError("GITHUB_RATE_LIMITED");
    const snapshot = vi.fn(async () => {
      throw offline;
    });
    const cache = open(fakeProvider({ snapshot }));
    await cache.refresh();
    snapshot.mockRejectedValueOnce(limited);
    later(2 * minute);
    await cache.refresh();
    const { paused, failure, stages } = cache.status();
    expect(paused).toEqual({ until: fullBudget.resetAt, reason: "rateLimit" });
    // The rate limit pauses the cycle and leaves the earlier failure held.
    expect(failure).toBe(offline);
    expect(stages).toEqual([
      { repo, stage: { kind: "paused", reason: "rateLimit" } },
      { repo: docs, stage: { kind: "paused", reason: "rateLimit" } },
    ]);
  });

  it("gives a failed repository the error that stopped it, not the one the status held before", async () => {
    const offline = providerError("GITHUB_UNREACHABLE");
    const refused = providerError("GITHUB_REQUEST_FAILED");
    const snapshot = vi.fn(async () => {
      throw offline;
    });
    const cache = open(fakeProvider({ snapshot }));
    await cache.refresh();
    snapshot.mockRejectedValueOnce(refused);
    later(2 * minute);
    await cache.refresh();
    const { failure, stages } = cache.status();
    expect(failure).toBe(refused);
    expect(stages.at(0)).toEqual({
      repo,
      stage: { kind: "failed", error: refused },
    });
  });

  it("names a failure that is not the provider's as the status names it", async () => {
    const cache = open(
      fakeProvider({
        snapshot: async () => {
          throw new Error("The disk is full.");
        },
      }),
    );
    await cache.refresh();
    const { failure, stages } = cache.status();
    expect(stages.at(0)?.stage).toEqual({ kind: "failed", error: failure });
    expect(failure?.code).toBe("CACHE_REFRESH_FAILED");
  });

  it("drops a rate limit's pause once its time is past and a refresh reads again", async () => {
    const limited = providerError("GITHUB_RATE_LIMITED");
    const seen: unknown[] = [];
    const snapshot = vi.fn(async () => {
      seen.push(cache.status().paused);
      return { threads: [], cursor: null };
    });
    snapshot.mockRejectedValueOnce(limited);
    const cache = open(fakeProvider({ snapshot }));
    await cache.refresh();
    expect(cache.status().paused?.reason).toBe("rateLimit");
    later(61 * minute);
    await cache.refresh();
    expect(seen).toEqual([undefined, undefined]);
  });

  it("hands out the threads once a refresh ends, not as each repository arrives", async () => {
    const cache = open(fakeProvider({ snapshot }));
    await cache.refresh();
    later(2 * minute);
    const before = cache.threads();
    const lists = new Set<unknown>();
    cache.subscribe(() => lists.add(cache.threads()));
    await cache.refresh();
    expect(lists.size).toBe(2);
    expect(lists.has(before)).toBe(true);
    expect(cache.threads()).not.toBe(before);
  });

  it("tells its listeners as often however many pages a background re-read takes, since none is drawn", async () => {
    const counts: number[] = [];
    for (const pages of [2, 10]) {
      const paged = vi.fn(
        async (
          name: string,
          _cursor: unknown,
          onPage?: (progress: PageProgress) => void,
        ) => {
          for (let fetched = 1; fetched <= pages; fetched += 1) {
            onPage?.({ fetched, total: pages });
          }
          return { threads: [thread({ repo: name })], cursor: null };
        },
      );
      directory = join(root, `pages-${pages}`);
      const cache = open(fakeProvider({ snapshot: paged }));
      await cache.refresh();
      // The hourly whole re-read reads every page again.
      later(61 * minute);
      let told = 0;
      cache.subscribe(() => {
        told += 1;
      });
      await cache.refresh();
      counts.push(told);
    }
    expect(counts).toHaveLength(2);
    expect(counts.at(1)).toBe(counts.at(0));
  });

  it("runs a first refresh that may not spend as a background one, never a full refresh", async () => {
    const cache = open(
      fakeProvider({
        budget: () => ({ graphql: { ...fullBudget, remaining: 999 } }),
      }),
    );
    const seen: boolean[] = [];
    cache.subscribe(() => seen.push(cache.status().whole));
    await cache.refresh();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen).not.toContain(true);
  });

  it("keeps each repository paused while the budget is low and it needs points to go on", async () => {
    const cache = open(
      fakeProvider({
        budget: () => ({ graphql: { ...fullBudget, remaining: 999 } }),
      }),
    );
    await cache.refresh();
    expect(cache.status()).toMatchObject({
      paused: { until: fullBudget.resetAt, reason: "budget" },
      whole: false,
      stages: [
        { repo, stage: { kind: "paused", reason: "budget" } },
        { repo: docs, stage: { kind: "paused", reason: "budget" } },
      ],
    });
  });

  it("starts every repository waiting again on a full refresh", async () => {
    const cache = open(fakeProvider({ snapshot }));
    await cache.refresh();
    later(2 * minute);
    const first: unknown[] = [];
    cache.subscribe(() => {
      // The threads thrown away are handed out first, then the run.
      if (first.length === 0 && cache.status().refreshing) {
        first.push(cache.status());
      }
    });
    await cache.fullRefresh();
    expect(first.at(0)).toMatchObject({
      whole: true,
      stages: [
        { repo, stage: { kind: "waiting" } },
        { repo: docs, stage: { kind: "waiting" } },
      ],
    });
  });
});
