import type { PageProgress, Provider } from "../provider/index.js";
import applyChecks from "./applyChecks.js";
import refreshChecks from "./refreshChecks.js";
import syncRepo, { type SyncOptions } from "./syncRepo.js";
import type { RepoCache, RepoProgress, RepoStage } from "./types.js";

/** The stages of a repository the refresh is on, which a failure stops. */
const underWay: ReadonlySet<RepoStage["kind"]> = new Set([
  "checking",
  "reading",
  "checks",
]);

/** What fetching the watched repositories reads, keeps and reports. */
export interface FetchReposOptions extends Omit<SyncOptions, "onStage"> {
  readonly provider: Provider;
  /** The watched repositories, as `owner/name`, in the order fetched. */
  readonly repos: readonly string[];
  /** When the fetch started, which dates every repository. */
  readonly at: Date;
  /** What is held for a repository before its fetch. */
  readonly find: (repo: string) => RepoCache | undefined;
  /** Keeps a repository's data, once fetched and once its checks are read. */
  readonly keep: (repo: string, value: RepoCache) => void;
  /**
   * Hears every repository's stage, in the order fetched, whenever one
   * changes: each is `waiting` at first.
   */
  readonly report: (stages: readonly RepoProgress[]) => void;
  /**
   * Whether the checks still running are read again once every
   * repository is fetched, when points may be spent.
   */
  readonly checks?: boolean;
}

/**
 * Fetches every watched repository in turn, as `syncRepo` does, keeping
 * each as it arrives, so a failure keeps those fetched before it, then
 * reads again the checks still running on all of them at once. It
 * reports each repository's stage as it goes: the one a failure stops
 * on is `failed`, and those after it stay `waiting`.
 *
 * @note Impure: reads from the provider.
 */
export default async function fetchRepos({
  provider,
  repos,
  at,
  find,
  keep,
  report,
  spend = true,
  reconcile = true,
  checks = true,
}: FetchReposOptions): Promise<void> {
  let stages: readonly RepoProgress[] = repos.map((repo) => ({
    repo,
    stage: { kind: "waiting" },
  }));
  const reach = (
    names: readonly string[],
    stage: (repo: string) => RepoStage,
  ) => {
    stages = stages.map((each) =>
      names.includes(each.repo) ? { ...each, stage: stage(each.repo) } : each,
    );
    report(stages);
  };
  report(stages);
  const synced = new Map<string, RepoCache>();
  // The pages each repository's read reached, which its later stages keep.
  const pages = new Map<string, PageProgress>();
  const reached = (repo: string) => pages.get(repo) ?? { fetched: 0, total: 0 };
  const finish = (repo: string, value: RepoCache) =>
    reach([repo], () => ({
      kind: "done",
      threads: value.threads.length,
      ...reached(repo),
    }));
  try {
    for (const repo of repos) {
      const value = await syncRepo(provider, repo, find(repo), at, {
        spend,
        reconcile,
        onStage: (stage) => {
          if (stage.kind === "reading") {
            pages.set(repo, { fetched: stage.fetched, total: stage.total });
          }
          reach([repo], () => stage);
        },
      });
      if (!value) continue;
      synced.set(repo, value);
      keep(repo, value);
      finish(repo, value);
    }
    const refreshed =
      spend && checks
        ? await refreshChecks(provider, [...synced.values()], (covered) =>
            reach(covered, (repo) => ({ kind: "checks", ...reached(repo) })),
          )
        : [];
    for (const [repo, value] of synced) {
      const threads = applyChecks(value.threads, refreshed);
      keep(repo, { ...value, threads });
      finish(repo, { ...value, threads });
    }
  } catch (error) {
    reach(
      stages
        .filter(({ stage }) => underWay.has(stage.kind))
        .map(({ repo }) => repo),
      () => ({ kind: "failed" }),
    );
    throw error;
  }
}
