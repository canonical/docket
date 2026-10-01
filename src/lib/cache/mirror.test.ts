import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
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
import type { Budgets, Provider } from "../provider/index.js";
import { budgetFolderName, lockName } from "./constants.js";
import createCache from "./createCache.js";
import identifyFile from "./identifyFile.js";
import withFetchLock from "./withFetchLock.js";
import writeBudgetFile from "./writeBudgetFile.js";

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";
const clock = new Date("2026-09-28T10:00:00Z");
const nextHour = new Date("2026-09-28T12:00:00Z");

let root: string;
let directory: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-mirror-"));
  directory = join(root, "docket");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const makeBudget = (remaining: number, resetAt = fullBudget.resetAt) => ({
  ...fullBudget,
  remaining,
  resetAt,
});

/** A provider whose answers so far reported `heard`, which a test moves. */
const makeHearingProvider = (overrides: Partial<Provider> = {}) => {
  const answers = { heard: {} as Budgets };
  const provider = fakeProvider({
    snapshot: vi.fn(async () => ({ threads: [thread()], cursor: null })),
    readBudgets: () => answers.heard,
    ...overrides,
  });
  return { provider, answers };
};

/** A cache opened as a process of its own, with its own budget file. */
const open = (
  provider: Provider,
  repos = [repo],
  processId: string = randomUUID(),
  at = clock,
) => createCache({ provider, repos, directory, now: () => at, processId });
/** The budget folder's file of the process `processId` names. */
const budgetFile = (processId: string) =>
  join(directory, budgetFolderName, `${processId}.json`);

describe("the budget mirror of createCache", () => {
  it("gives every process the budgets any process heard, through the budget folder", async () => {
    const { provider, answers } = makeHearingProvider();
    answers.heard = { graphql: makeBudget(900), rest: makeBudget(4000) };
    await open(provider).refresh();
    const other = open(makeHearingProvider().provider);
    await other.load();
    expect(other.readBudgets()).toEqual({
      graphql: makeBudget(900),
      rest: makeBudget(4000),
    });
  });

  it("keeps, of the folder's reports and its own answers', the later of each kind", async () => {
    const { provider, answers } = makeHearingProvider();
    answers.heard = { graphql: makeBudget(3000), rest: makeBudget(4000) };
    await open(provider).refresh();
    const own = makeHearingProvider();
    const other = open(own.provider);
    own.answers.heard = {
      graphql: makeBudget(3500),
      rest: makeBudget(4999, nextHour),
    };
    await other.load();
    expect(other.readBudgets()).toEqual({
      graphql: makeBudget(3000),
      rest: makeBudget(4999, nextHour),
    });
  });

  it("says the floor before it hands out the threads it loads, so no frame drawn from them reads ahead below it", async () => {
    const { provider, answers } = makeHearingProvider();
    // The fetch's own answer leaves the budget below the floor.
    const snapshot = vi.fn(async () => {
      answers.heard = { graphql: makeBudget(900) };
      return { threads: [thread()], cursor: null };
    });
    await open({ ...provider, snapshot }).refresh();
    const pane = open(makeHearingProvider().provider);
    const seen: { threads: number; paused: unknown }[] = [];
    pane.subscribe(() =>
      seen.push({
        threads: pane.threads().threads.length,
        paused: pane.status().paused,
      }),
    );
    await pane.load();
    expect(seen.find(({ threads }) => threads > 0)).toEqual({
      threads: 1,
      paused: { until: fullBudget.resetAt, reason: "budget" },
    });
  });

  it("pauses at the floor another process's answers reached, with their reset, and spends nothing", async () => {
    const { provider, answers } = makeHearingProvider();
    answers.heard = { graphql: makeBudget(999) };
    const writer = open(provider);
    await writer.keepBudget();
    const own = makeHearingProvider();
    const other = open(own.provider);
    await other.load();
    expect(other.maySpend()).toBe(false);
    expect(other.status().paused).toEqual({
      until: fullBudget.resetAt,
      reason: "budget",
    });
    await other.refresh();
    expect(own.provider.snapshot).not.toHaveBeenCalled();
  });

  it("says the pause as soon as a read of its own takes the budget below the floor", async () => {
    const { provider, answers } = makeHearingProvider();
    const cache = open(provider);
    await cache.refresh();
    answers.heard = { graphql: makeBudget(900) };
    await cache.keepBudget();
    expect(cache.status().paused).toEqual({
      until: fullBudget.resetAt,
      reason: "budget",
    });
  });

  it("says the pause as a refresh starts, while another process holds the lock", async () => {
    const { provider, answers } = makeHearingProvider();
    const cache = open(provider);
    await cache.refresh();
    const held = Promise.withResolvers<void>();
    const holding = withFetchLock(directory, () => held.promise);
    await waitUntil(async () => {
      expect(await readdir(directory)).toContain(lockName);
    });
    answers.heard = { graphql: makeBudget(900) };
    const running = cache.refresh();
    try {
      expect(cache.status().paused).toEqual({
        until: fullBudget.resetAt,
        reason: "budget",
      });
    } finally {
      held.resolve();
      await Promise.all([holding, running]);
    }
  });

  it("says the pause as it keeps the budget, while another process holds the fetch lock", async () => {
    const { provider, answers } = makeHearingProvider();
    const cache = open(provider);
    await cache.refresh();
    const held = Promise.withResolvers<void>();
    const holding = withFetchLock(directory, () => held.promise);
    await waitUntil(async () => {
      expect(await readdir(directory)).toContain(lockName);
    });
    answers.heard = { graphql: makeBudget(900) };
    const keeping = cache.keepBudget();
    try {
      expect(cache.status().paused).toEqual({
        until: fullBudget.resetAt,
        reason: "budget",
      });
    } finally {
      held.resolve();
      await Promise.all([holding, keeping]);
    }
  });

  it("says the pause once the read after a write takes the budget below the floor", async () => {
    const { provider, answers } = makeHearingProvider();
    const cache = open(provider);
    await cache.refresh();
    const snapshot = vi.fn(async () => {
      answers.heard = { graphql: makeBudget(900) };
      return { threads: [thread()], cursor: null };
    });
    const writer = open({ ...provider, snapshot });
    await writer.load();
    await writer.refreshRepo(repo);
    expect(snapshot).toHaveBeenCalledOnce();
    expect(writer.status().paused).toEqual({
      until: fullBudget.resetAt,
      reason: "budget",
    });
  });

  it("stops docket's own spending below the floor, and still spends on what the user asks for", async () => {
    const { provider, answers } = makeHearingProvider();
    await open(provider).refresh();
    answers.heard = { graphql: makeBudget(999) };
    const cache = open(provider);
    await cache.load();
    expect(cache.maySpend()).toBe(false);
    vi.mocked(provider.snapshot).mockClear();
    await cache.refresh("waking");
    expect(provider.snapshot).not.toHaveBeenCalled();
    expect(await cache.refreshIfChanged(repo)).toBe(false);
    expect(provider.snapshot).not.toHaveBeenCalled();
    await cache.read(0);
    expect(provider.snapshot).toHaveBeenCalledOnce();
    expect(await cache.fullRefresh()).toBe(true);
    expect(provider.snapshot).toHaveBeenCalledTimes(2);
  });

  it("stops spending at the repository the refresh's own answers take below the floor", async () => {
    const { provider, answers } = makeHearingProvider();
    const snapshot = vi.fn(async () => {
      answers.heard = { graphql: makeBudget(999) };
      return { threads: [thread()], cursor: null };
    });
    const cache = open({ ...provider, snapshot }, [repo, docs]);
    await cache.refresh();
    expect(snapshot).toHaveBeenCalledOnce();
    expect(cache.status().stages.at(1)).toEqual({
      repo: docs,
      stage: { kind: "paused", reason: "budget" },
    });
    expect(cache.status().paused).toEqual({
      until: fullBudget.resetAt,
      reason: "budget",
    });
  });

  it("lets points be spent above the floor, and leaves a rate limit's pause as it is", async () => {
    const { provider, answers } = makeHearingProvider();
    const cache = open({
      ...provider,
      snapshot: async () => {
        answers.heard = { graphql: makeBudget(0) };
        throw providerError("GITHUB_RATE_LIMITED");
      },
    });
    await cache.refresh();
    expect(cache.maySpend()).toBe(false);
    expect(cache.status().paused).toEqual({
      until: fullBudget.resetAt,
      reason: "rateLimit",
    });
    answers.heard = { graphql: makeBudget(1000) };
    const fresh = open(provider);
    expect(fresh.maySpend()).toBe(true);
    expect(fresh.status().paused).toBeUndefined();
  });

  it("writes its own budget file only when what it heard changed since its last write", async () => {
    const { provider, answers } = makeHearingProvider();
    const cache = open(provider, [repo], "writer");
    answers.heard = { graphql: makeBudget(2000) };
    await cache.keepBudget();
    const written = await identifyFile(budgetFile("writer"));
    expect(written).toBeDefined();
    await cache.keepBudget();
    expect(await identifyFile(budgetFile("writer"))).toBe(written);
    answers.heard = { graphql: makeBudget(1900) };
    await cache.keepBudget();
    expect(await identifyFile(budgetFile("writer"))).not.toBe(written);
    const other = open(makeHearingProvider().provider);
    await other.load();
    expect(other.readBudgets()).toEqual({ graphql: makeBudget(1900) });
  });

  it("gives readers the lowest figure when two processes keep falling figures together", async () => {
    const one = makeHearingProvider();
    const two = makeHearingProvider();
    const first = open(one.provider);
    const second = open(two.provider);
    const keeping: Promise<void>[] = [];
    for (const remaining of [950, 900, 850, 800, 750, 700]) {
      const { answers } = remaining % 100 === 0 ? one : two;
      answers.heard = { graphql: makeBudget(remaining) };
      keeping.push(first.keepBudget(), second.keepBudget());
    }
    await Promise.all(keeping);
    const reader = open(makeHearingProvider().provider);
    await reader.load();
    expect(reader.readBudgets()).toEqual({ graphql: makeBudget(700) });
  });

  it("takes no lock to keep the budget, leaving only each process's own file", async () => {
    const { provider, answers } = makeHearingProvider();
    answers.heard = { graphql: makeBudget(900) };
    await open(provider, [repo], "one").keepBudget();
    await open(provider, [repo], "two").keepBudget();
    expect(await readdir(directory)).toEqual([budgetFolderName]);
    expect((await readdir(join(directory, budgetFolderName))).sort()).toEqual([
      "one.json",
      "two.json",
    ]);
  });

  it("keeps a figure heard while another process holds the fetch lock", async () => {
    const held = Promise.withResolvers<void>();
    const holding = withFetchLock(directory, () => held.promise);
    try {
      await waitUntil(async () => {
        expect(await readdir(directory)).toContain(lockName);
      });
      const { provider, answers } = makeHearingProvider();
      answers.heard = { graphql: makeBudget(900) };
      await open(provider).keepBudget();
    } finally {
      held.resolve();
      await holding;
    }
    const other = open(makeHearingProvider().provider);
    await other.load();
    expect(other.readBudgets()).toEqual({ graphql: makeBudget(900) });
  });

  it("takes another process's figures as it writes its budget file, while it watches", async () => {
    const pane = open(makeHearingProvider().provider);
    await pane.load();
    const stop = pane.watch();
    try {
      const { provider, answers } = makeHearingProvider();
      answers.heard = { graphql: makeBudget(900) };
      await open(provider).keepBudget();
      await waitUntil(() => {
        expect(pane.readBudgets()).toEqual({ graphql: makeBudget(900) });
        expect(pane.status().paused).toEqual({
          until: fullBudget.resetAt,
          reason: "budget",
        });
      });
    } finally {
      stop();
    }
  });

  it("keeps the figures it holds when another process's budget file goes missing", async () => {
    const { provider, answers } = makeHearingProvider();
    answers.heard = { graphql: makeBudget(900) };
    await open(provider, [repo], "leaving").keepBudget();
    const pane = open(makeHearingProvider().provider);
    await pane.load();
    await rm(budgetFile("leaving"));
    await pane.load();
    expect(pane.readBudgets()).toEqual({ graphql: makeBudget(900) });
  });

  it("passes over the budget file a dead process left once its reset has passed", async () => {
    const { provider, answers } = makeHearingProvider();
    answers.heard = { graphql: makeBudget(900) };
    await open(provider, [repo], "dead").keepBudget();
    const before = open(makeHearingProvider().provider);
    await before.load();
    expect(before.maySpend()).toBe(false);
    const after = open(
      makeHearingProvider({ readBudgets: () => ({}) }).provider,
      [repo],
      "after",
      new Date(fullBudget.resetAt.getTime() + 1),
    );
    await after.load();
    expect(after.readBudgets()).toEqual({});
    expect(after.maySpend()).toBe(true);
  });

  it("passes over a torn budget file, and reads the others", async () => {
    await mkdir(join(directory, budgetFolderName), { recursive: true });
    await writeFile(budgetFile("torn"), '{"graphql":{"limit":5000,"rem');
    const { provider, answers } = makeHearingProvider();
    answers.heard = { graphql: makeBudget(900) };
    await open(provider, [repo], "whole").keepBudget();
    const reader = open(makeHearingProvider().provider);
    await reader.load();
    expect(reader.readBudgets()).toEqual({ graphql: makeBudget(900) });
  });

  it("judges the floor on its own answer while its clock runs two hours behind GitHub's, and drops one that resets later still", async () => {
    const { provider, answers } = makeHearingProvider();
    const cache = open(provider);
    const behind = new Date(clock.getTime() + 2.5 * 3_600_000);
    answers.heard = {
      graphql: { ...fullBudget, remaining: 900, resetAt: behind },
    };
    expect(cache.maySpend()).toBe(false);
    answers.heard = {
      graphql: {
        ...fullBudget,
        remaining: 900,
        resetAt: new Date("9999-12-31T00:00:00Z"),
      },
    };
    expect(cache.readBudgets()).toEqual({});
    expect(cache.maySpend()).toBe(true);
  });

  it("judges no floor on a report in a budget file that resets past GitHub's window", async () => {
    await writeBudgetFile(budgetFile("far"), {
      graphql: {
        ...fullBudget,
        remaining: 0,
        resetAt: new Date("9999-12-31T00:00:00Z"),
      },
    });
    const cache = open(makeHearingProvider().provider);
    await cache.load();
    expect(cache.readBudgets()).toEqual({});
    expect(cache.maySpend()).toBe(true);
    expect(cache.status().paused).toBeUndefined();
  });

  it("reads and saves the cache though its budget file cannot be written, and writes it at the next keeping", async () => {
    await mkdir(join(budgetFile("blocked"), "inside"), { recursive: true });
    const { provider, answers } = makeHearingProvider();
    answers.heard = { graphql: makeBudget(2000) };
    const cache = open(provider, [repo], "blocked");
    await expect(cache.read(0)).resolves.toMatchObject({
      threads: [thread()],
    });
    await expect(cache.keepBudget()).resolves.toBeUndefined();
    const other = open(makeHearingProvider().provider);
    await other.load();
    expect(other.threads().threads).toEqual([thread()]);
    expect(other.readBudgets()).toEqual({});
    await rm(budgetFile("blocked"), { recursive: true });
    await cache.keepBudget();
    await other.load();
    expect(other.readBudgets()).toEqual({ graphql: makeBudget(2000) });
  });
});
