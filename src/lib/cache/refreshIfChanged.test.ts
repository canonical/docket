import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import {
  everyCapability,
  fakeProvider,
  fullBudget,
  providerError,
} from "../../testing/provider.js";
import type { Provider } from "../provider/index.js";
import createCache from "./createCache.js";

const repo = "example-org/example-repo";

let root: string;
let directory: string;
const clock = new Date("2026-09-28T10:00:00Z");

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-changed-"));
  directory = join(root, "docket");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/**
 * A provider whose check sees a change when `changed` says so, and whose
 * snapshot since a cursor holds thread 2.
 */
const watching = (changed: () => boolean, overrides: Partial<Provider> = {}) =>
  fakeProvider({
    probe: vi.fn(async () => ({ changed: changed(), tag: '"tag"' })),
    snapshot: vi.fn(async (_repo, cursor) => ({
      threads: [thread({ number: cursor ? 2 : 1 })],
      cursor: { since: "2026-09-28T09:59:00Z" },
    })),
    ...overrides,
  });

/** A cache on `provider` that has fetched the repository whole once. */
async function openFetched(provider: Provider) {
  const cache = createCache({
    provider,
    repos: [repo],
    directory,
    now: () => clock,
  });
  await cache.refresh();
  vi.mocked(provider.snapshot).mockClear();
  return cache;
}

describe("the refreshIfChanged step of createCache", () => {
  it("fetches what changed when the free check sees a change, for every process, and says so", async () => {
    let changed = false;
    const provider = watching(() => changed);
    const cache = await openFetched(provider);
    changed = true;
    expect(await cache.refreshIfChanged(repo)).toBe(true);
    expect(provider.snapshot).toHaveBeenCalledOnce();
    expect(cache.threads().threads.map(({ number }) => number)).toEqual([1, 2]);
    const other = createCache({
      provider: fakeProvider(),
      repos: [repo],
      directory,
      now: () => clock,
    });
    await other.load();
    expect(other.threads().threads).toHaveLength(2);
  });

  it("fetches nothing, and says so, when the check sees no change", async () => {
    const provider = watching(() => false);
    const cache = await openFetched(provider);
    expect(await cache.refreshIfChanged(repo)).toBe(false);
    expect(provider.snapshot).not.toHaveBeenCalled();
  });

  it("spends nothing below the budget floor, though the check sees a change", async () => {
    let remaining = fullBudget.remaining;
    const provider = watching(() => true, {
      budget: async () => ({ ...fullBudget, remaining }),
    });
    const cache = await openFetched(provider);
    remaining = 999;
    expect(await cache.refreshIfChanged(repo)).toBe(false);
    expect(provider.probe).toHaveBeenCalledTimes(2);
    expect(provider.snapshot).not.toHaveBeenCalled();
  });

  it("asks nothing while rate limited, of a provider with no free check, or for a repository with nothing held", async () => {
    const limited = watching(() => true, {
      snapshot: vi.fn(async () => {
        throw providerError("GITHUB_RATE_LIMITED");
      }),
    });
    const refused = createCache({
      provider: limited,
      repos: [repo],
      directory,
      now: () => clock,
    });
    await refused.refresh();
    expect(await refused.refreshIfChanged(repo)).toBe(false);
    expect(limited.probe).toHaveBeenCalledOnce();

    const capabilities = new Set(everyCapability);
    capabilities.delete("changeProbe");
    const blind = watching(() => true, { capabilities: () => capabilities });
    expect(await (await openFetched(blind)).refreshIfChanged(repo)).toBe(false);
    expect(blind.snapshot).not.toHaveBeenCalled();

    const empty = watching(() => true);
    const nothing = createCache({
      provider: empty,
      repos: [repo],
      directory: join(root, "empty"),
      now: () => clock,
    });
    expect(await nothing.refreshIfChanged(repo)).toBe(false);
    expect(empty.probe).not.toHaveBeenCalled();
  });

  it("names a cache folder it cannot use", async () => {
    const cache = createCache({
      provider: watching(() => true),
      repos: [repo],
      directory: join(root, "file", "docket"),
      now: () => clock,
    });
    await Bun.write(join(root, "file"), "");
    await expect(cache.refreshIfChanged(repo)).rejects.toMatchObject({
      code: "CACHE_UNUSABLE",
    });
  });
});
