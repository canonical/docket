import { describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import { fakeProvider, providerError } from "../../testing/provider.js";
import type { PageProgress } from "../provider/index.js";
import fetchRepos, { type FetchReposOptions } from "./fetchRepos.js";
import type { RepoCache, RepoProgress, RepoStage } from "./types.js";

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
  const reported: (readonly RepoProgress[])[] = [];
  const fetching = fetchRepos({
    provider: fakeProvider({ snapshot: paged }),
    repos: [repo, docs],
    at,
    find: (name) => found[name],
    keep: (name, value) => kept.push([name, value]),
    report: (stages) => reported.push(stages),
    ...options,
  });
  return { fetching, kept, reported };
}

/** Each report's stage of `name`, once for each change. */
const stagesOf = (
  reported: readonly (readonly RepoProgress[])[],
  name: string,
): RepoStage[] =>
  reported
    .map((stages) => stages.find((each) => each.repo === name)?.stage)
    .filter((stage): stage is RepoStage => stage !== undefined)
    .filter(
      (stage, place, all) =>
        place === 0 || JSON.stringify(stage) !== JSON.stringify(all[place - 1]),
    );

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

  it("reports every repository waiting, in order, then each stage of a whole fetch, page by page, to its threads", async () => {
    const { fetching, reported } = fetchFrom({});
    await fetching;
    expect(reported.at(0)).toEqual([
      { repo, stage: { kind: "waiting" } },
      { repo: docs, stage: { kind: "waiting" } },
    ]);
    expect(stagesOf(reported, docs)).toEqual([
      { kind: "waiting" },
      { kind: "checking" },
      { kind: "reading", fetched: 0, total: 0 },
      { kind: "reading", fetched: 1, total: 2 },
      { kind: "reading", fetched: 2, total: 2 },
      { kind: "done", threads: 1, fetched: 2, total: 2 },
    ]);
    expect(reported.at(-1)).toEqual([
      { repo, stage: { kind: "done", threads: 1, fetched: 2, total: 2 } },
      { repo: docs, stage: { kind: "done", threads: 1, fetched: 2, total: 2 } },
    ]);
  });

  it("reads the checks still running once every repository is fetched, marking the repositories they cover, and keeps them", async () => {
    const provider = fakeProvider({
      probe: async () => ({ changed: false, tag: '"tag-1"' }),
      refreshVolatile: vi.fn(async () => [
        { repo, number: 3, checks: "passing" as const },
      ]),
    });
    const { fetching, kept, reported } = fetchFrom(
      { provider },
      { [repo]: held, [docs]: { ...held, threads: [] } },
    );
    await fetching;
    expect(kept.at(-2)).toEqual([
      repo,
      { ...held, threads: [{ ...running, checks: "passing" }] },
    ]);
    expect(stagesOf(reported, repo)).toEqual([
      { kind: "waiting" },
      { kind: "checking" },
      { kind: "done", threads: 1, fetched: 0, total: 0 },
      { kind: "checks", fetched: 0, total: 0 },
      { kind: "done", threads: 1, fetched: 0, total: 0 },
    ]);
    expect(stagesOf(reported, docs).map(({ kind }) => kind)).not.toContain(
      "checks",
    );
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

  it("keeps nothing of a repository that needs points it may not spend, and reports it paused", async () => {
    const { fetching, kept, reported } = fetchFrom({ spend: false });
    await fetching;
    expect(kept).toEqual([]);
    expect(reported.at(-1)).toEqual([
      { repo, stage: { kind: "paused" } },
      { repo: docs, stage: { kind: "paused" } },
    ]);
  });

  it("keeps the repositories fetched before one that fails, reports it failed and those after it waiting, and throws its error", async () => {
    const error = providerError("GITHUB_TIMED_OUT");
    const snapshot = vi.fn(async (name: string) => {
      if (name === docs) throw error;
      return { threads: [], cursor: null };
    });
    const { fetching, kept, reported } = fetchFrom({
      provider: fakeProvider({ snapshot }),
      repos: [repo, docs, "example-org/example-site"],
    });
    await expect(fetching).rejects.toBe(error);
    expect(kept.map(([name]) => name)).toEqual([repo]);
    expect(reported.at(-1)).toEqual([
      { repo, stage: { kind: "done", threads: 0, fetched: 0, total: 0 } },
      { repo: docs, stage: { kind: "failed" } },
      { repo: "example-org/example-site", stage: { kind: "waiting" } },
    ]);
  });

  it("reports the repositories whose checks it was reading failed when that read fails", async () => {
    const error = providerError("GITHUB_TIMED_OUT");
    const provider = fakeProvider({
      probe: async () => ({ changed: false, tag: '"tag-1"' }),
      refreshVolatile: async () => {
        throw error;
      },
    });
    const { fetching, reported } = fetchFrom(
      { provider, repos: [repo] },
      { [repo]: held },
    );
    await expect(fetching).rejects.toBe(error);
    expect(reported.at(-1)).toEqual([{ repo, stage: { kind: "failed" } }]);
  });
});
