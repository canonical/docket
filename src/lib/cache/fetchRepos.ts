import type { PageProgress, Provider } from "../provider/index.js";
import applyChecks from "./applyChecks.js";
import refreshChecks from "./refreshChecks.js";
import syncRepo, { type SyncOptions } from "./syncRepo.js";
import type { FullRefreshProgress, RepoCache } from "./types.js";

/** What fetching the watched repositories reads, keeps and reports. */
export interface FetchReposOptions extends Omit<SyncOptions, "onPage"> {
  readonly provider: Provider;
  /** The watched repositories, as `owner/name`, in the order fetched. */
  readonly repos: readonly string[];
  /** When the fetch started, which dates every repository. */
  readonly at: Date;
  /** What is held for a repository before its fetch. */
  readonly find: (repo: string) => RepoCache | undefined;
  /** Keeps a repository's data, once fetched and once its checks are read. */
  readonly keep: (repo: string, value: RepoCache) => void;
  /** Hears the progress of each repository fetched whole while it waits. */
  readonly report: (progress: FullRefreshProgress) => void;
  /**
   * Whether the checks still running are read again once every
   * repository is fetched, when points may be spent.
   */
  readonly checks?: boolean;
}

/**
 * Fetches every watched repository in turn, as `syncRepo` does, keeping
 * each as it arrives, so a failure keeps those fetched before it, then
 * reads again the checks still running on all of them at once.
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
  const synced = new Map<string, RepoCache>();
  for (const [index, repo] of repos.entries()) {
    const previous = find(repo);
    // A repository with nothing to show is fetched whole while the list
    // waits for it, so its progress is reported.
    const onPage =
      previous || !spend
        ? undefined
        : (pages: PageProgress) =>
            report({
              repo,
              position: index + 1,
              count: repos.length,
              ...pages,
            });
    onPage?.({ fetched: 0, total: 0 });
    const value = await syncRepo(provider, repo, previous, at, {
      spend,
      reconcile,
      onPage,
    });
    if (!value) continue;
    synced.set(repo, value);
    keep(repo, value);
  }
  const refreshed =
    spend && checks ? await refreshChecks(provider, [...synced.values()]) : [];
  for (const [repo, value] of synced) {
    keep(repo, { ...value, threads: applyChecks(value.threads, refreshed) });
  }
}
