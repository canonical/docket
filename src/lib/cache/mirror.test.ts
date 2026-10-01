import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
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
import { budgetFileName, cacheFileName, lockName } from "./constants.js";
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

const open = (provider: Provider, repos = [repo]) =>
  createCache({ provider, repos, directory, now: () => clock });

describe("the budget mirror of createCache", () => {
  it("gives every process the budgets any process heard, through the cache file", async () => {
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

  it("keeps, of the file's report and its own answers', the later of each kind", async () => {
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

  it("says the pause as it keeps the budget, before it tries the lock another process holds", async () => {
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

  it("writes the budgets heard outside a refresh, and leaves the file alone when it holds none later", async () => {
    const { provider, answers } = makeHearingProvider();
    const cache = open(provider);
    answers.heard = { graphql: makeBudget(2000) };
    await cache.keepBudget();
    const file = join(directory, cacheFileName);
    const written = await identifyFile(file);
    const same = makeHearingProvider();
    same.answers.heard = { graphql: makeBudget(2000) };
    await open(same.provider).keepBudget();
    expect(await identifyFile(file)).toBe(written);
    const other = open(makeHearingProvider().provider);
    await other.load();
    expect(other.readBudgets()).toEqual({ graphql: makeBudget(2000) });
  });

  it("keeps a figure heard while another process holds the fetch lock and writes nothing", async () => {
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

  it("judges no floor on a report in the budget file that resets past GitHub's window", async () => {
    await writeBudgetFile(join(directory, budgetFileName), {
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

  it("reads and saves the cache though the budget file cannot be written, keeping no figure", async () => {
    await mkdir(join(directory, budgetFileName, "inside"), { recursive: true });
    const { provider, answers } = makeHearingProvider();
    answers.heard = { graphql: makeBudget(2000) };
    const cache = open(provider);
    await expect(cache.read(0)).resolves.toMatchObject({
      threads: [thread()],
    });
    await expect(cache.keepBudget()).resolves.toBeUndefined();
    const other = open(makeHearingProvider().provider);
    await other.load();
    expect(other.threads().threads).toEqual([thread()]);
    expect(other.readBudgets()).toEqual({});
  });
});
