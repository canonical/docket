import { describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import { fakeProvider, providerError } from "../../testing/provider.js";
import type { PageProgress } from "../provider/index.js";
import fetchRepos, { type FetchReposOptions } from "./fetchRepos.js";
import type { FullRefreshProgress, RepoCache } from "./types.js";

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";
const at = new Date("2026-09-28T10:00:00Z");
const running = thread({ kind: "pullRequest", number: 3, checks: "running" });
const held: RepoCache = {
  threads: [running],
  cursor: { since: "2026-09-28T09:57:00Z" },
  tag: '"tag-1"',
  reconciledAt: new Date("2026-09-28T09:30:00Z"),
};

/** Snapshots of two pages, each repository holding one thread. */
const paged = vi.fn(
  async (
    name: string,
    _cursor: unknown,
    onPage?: (progress: PageProgress) => void,
  ) => {
    onPage?.({ fetched: 1, total: 2 });
    onPage?.({ fetched: 2, total: 2 });
    return { threads: [thread({ repo: name })], cursor: null };
  },
);

/** Fetches `repos` from `provider`, holding `found`, and what it heard. */
function fetchFrom(
  options: Partial<FetchReposOptions>,
  found: Readonly<Record<string, RepoCache>> = {},
) {
  const kept: [string, RepoCache][] = [];
  const reported: FullRefreshProgress[] = [];
  const fetching = fetchRepos({
    provider: fakeProvider({ snapshot: paged }),
    repos: [repo, docs],
    at,
    find: (name) => found[name],
    keep: (name, value) => kept.push([name, value]),
    report: (progress) => reported.push(progress),
    ...options,
  });
  return { fetching, kept, reported };
}

describe("fetchRepos", () => {
  it("fetches each repository in turn, keeping each as it arrives, dated when the fetch started", async () => {
    const { fetching, kept } = fetchFrom({});
    await fetching;
    expect(kept.map(([name]) => name)).toEqual([repo, docs, repo, docs]);
    expect(kept.at(0)?.[1]).toEqual({
      threads: [thread({ repo })],
      cursor: null,
      tag: undefined,
      reconciledAt: at,
    });
  });

  it("reports each page of a repository fetched whole, from 0 of 0", async () => {
    const { fetching, reported } = fetchFrom({});
    await fetching;
    expect(reported).toEqual([
      { repo, position: 1, count: 2, fetched: 0, total: 0 },
      { repo, position: 1, count: 2, fetched: 1, total: 2 },
      { repo, position: 1, count: 2, fetched: 2, total: 2 },
      { repo: docs, position: 2, count: 2, fetched: 0, total: 0 },
      { repo: docs, position: 2, count: 2, fetched: 1, total: 2 },
      { repo: docs, position: 2, count: 2, fetched: 2, total: 2 },
    ]);
  });

  it("reports nothing of a repository that holds data", async () => {
    const { fetching, reported } = fetchFrom({}, { [repo]: held });
    await fetching;
    expect(reported.map((progress) => progress.repo)).toEqual([
      docs,
      docs,
      docs,
    ]);
  });

  it("reads the checks still running once every repository is fetched, and keeps them", async () => {
    const provider = fakeProvider({
      probe: async () => ({ changed: false, tag: '"tag-1"' }),
      refreshVolatile: vi.fn(async () => [
        { repo, number: 3, checks: "passing" as const },
      ]),
    });
    const { fetching, kept } = fetchFrom(
      { provider, repos: [repo] },
      { [repo]: held },
    );
    await fetching;
    expect(kept.at(-1)).toEqual([
      repo,
      { ...held, threads: [{ ...running, checks: "passing" }] },
    ]);
  });

  it("reads no checks when told not to, or when nothing may be spent", async () => {
    for (const options of [{ checks: false }, { spend: false }]) {
      const provider = fakeProvider({
        probe: async () => ({ changed: false, tag: '"tag-1"' }),
        refreshVolatile: vi.fn(),
      });
      const { fetching } = fetchFrom(
        { provider, repos: [repo], ...options },
        { [repo]: held },
      );
      await fetching;
      expect(provider.refreshVolatile).not.toHaveBeenCalled();
    }
  });

  it("keeps nothing of a repository that needs points it may not spend, and reports no progress", async () => {
    const { fetching, kept, reported } = fetchFrom({ spend: false });
    await fetching;
    expect(kept).toEqual([]);
    expect(reported).toEqual([]);
  });

  it("keeps the repositories fetched before one that fails, and throws its error", async () => {
    const error = providerError("GITHUB_TIMED_OUT");
    const snapshot = vi.fn(async (name: string) => {
      if (name === docs) throw error;
      return { threads: [], cursor: null };
    });
    const { fetching, kept } = fetchFrom({
      provider: fakeProvider({ snapshot }),
    });
    await expect(fetching).rejects.toBe(error);
    expect(kept.map(([name]) => name)).toEqual([repo]);
  });
});
