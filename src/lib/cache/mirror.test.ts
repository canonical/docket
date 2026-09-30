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
import type { Budgets, Provider } from "../provider/index.js";
import { cacheFileName } from "./constants.js";
import createCache from "./createCache.js";
import identifyFile from "./identifyFile.js";

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

const leaving = (remaining: number, resetAt = fullBudget.resetAt) => ({
  ...fullBudget,
  remaining,
  resetAt,
});

/** A provider whose answers so far reported `heard`, which a test moves. */
const hearing = (overrides: Partial<Provider> = {}) => {
  const answers = { heard: {} as Budgets };
  const provider = fakeProvider({
    snapshot: vi.fn(async () => ({ threads: [thread()], cursor: null })),
    budget: () => answers.heard,
    ...overrides,
  });
  return { provider, answers };
};

const open = (provider: Provider, repos = [repo]) =>
  createCache({ provider, repos, directory, now: () => clock });

describe("the budget mirror of createCache", () => {
  it("gives every process the budgets any process heard, through the cache file", async () => {
    const { provider, answers } = hearing();
    answers.heard = { graphql: leaving(900), rest: leaving(4000) };
    await open(provider).refresh();
    const other = open(hearing().provider);
    await other.load();
    expect(other.budget()).toEqual({
      graphql: leaving(900),
      rest: leaving(4000),
    });
  });

  it("keeps, of the file's report and its own answers', the later of each kind", async () => {
    const { provider, answers } = hearing();
    answers.heard = { graphql: leaving(3000), rest: leaving(4000) };
    await open(provider).refresh();
    const own = hearing();
    const other = open(own.provider);
    own.answers.heard = {
      graphql: leaving(3500),
      rest: leaving(4999, nextHour),
    };
    await other.load();
    expect(other.budget()).toEqual({
      graphql: leaving(3000),
      rest: leaving(4999, nextHour),
    });
  });

  it("pauses at the floor another process's answers reached, with their reset, and spends nothing", async () => {
    const { provider, answers } = hearing();
    answers.heard = { graphql: leaving(999) };
    const writer = open(provider);
    await writer.keepBudget();
    const own = hearing();
    const other = open(own.provider);
    await other.load();
    expect(other.maySpend("background")).toBe(false);
    expect(other.status().paused).toEqual({
      until: fullBudget.resetAt,
      reason: "budget",
    });
    await other.refresh();
    expect(own.provider.snapshot).not.toHaveBeenCalled();
  });

  it("stops docket's own spending below the floor, and still spends on what the user asks for", async () => {
    const { provider, answers } = hearing();
    await open(provider).refresh();
    answers.heard = { graphql: leaving(999) };
    const cache = open(provider);
    await cache.load();
    expect(cache.maySpend("background")).toBe(false);
    expect(cache.maySpend("asked")).toBe(true);
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
    const { provider, answers } = hearing();
    const snapshot = vi.fn(async () => {
      answers.heard = { graphql: leaving(999) };
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
    const { provider, answers } = hearing();
    const cache = open({
      ...provider,
      snapshot: async () => {
        answers.heard = { graphql: leaving(0) };
        throw providerError("GITHUB_RATE_LIMITED");
      },
    });
    await cache.refresh();
    expect(cache.maySpend("background")).toBe(false);
    expect(cache.status().paused).toEqual({
      until: fullBudget.resetAt,
      reason: "rateLimit",
    });
    answers.heard = { graphql: leaving(1000) };
    const fresh = open(provider);
    expect(fresh.maySpend("background")).toBe(true);
    expect(fresh.status().paused).toBeUndefined();
  });

  it("writes the budgets heard outside a refresh, and leaves the file alone when it holds none later", async () => {
    const { provider, answers } = hearing();
    const cache = open(provider);
    answers.heard = { graphql: leaving(2000) };
    await cache.keepBudget();
    const file = join(directory, cacheFileName);
    const written = await identifyFile(file);
    await cache.keepBudget();
    expect(await identifyFile(file)).toBe(written);
    const other = open(hearing().provider);
    await other.load();
    expect(other.budget()).toEqual({ graphql: leaving(2000) });
  });

  it("names a cache folder it cannot use when it keeps the budgets", async () => {
    await Bun.write(join(root, "file"), "");
    const cache = createCache({
      provider: hearing().provider,
      repos: [repo],
      directory: join(root, "file", "docket"),
      now: () => clock,
    });
    await expect(cache.keepBudget()).rejects.toMatchObject({
      code: "CACHE_UNUSABLE",
    });
  });
});
