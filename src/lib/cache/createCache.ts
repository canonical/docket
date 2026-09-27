import { mkdirSync, watch as watchFolder } from "node:fs";
import { join } from "node:path";
import { dehydrate, hydrate, QueryClient } from "@tanstack/query-core";
import type { ProviderError } from "../provider/index.js";
import applyChecks from "./applyChecks.js";
import { budgetFloor, cacheFileName, refreshInterval } from "./constants.js";
import readCacheFile from "./readCacheFile.js";
import syncRepo from "./syncRepo.js";
import type {
  Cache,
  CachedThreads,
  CacheOptions,
  CacheStatus,
  RepoCache,
} from "./types.js";
import withFetchLock from "./withFetchLock.js";
import writeCacheFile from "./writeCacheFile.js";

/** Whether a provider threw `error`, with its code and recovery. */
const isProviderError = (error: unknown): error is ProviderError =>
  error instanceof Error &&
  typeof (error as Partial<ProviderError>).code === "string" &&
  typeof (error as Partial<ProviderError>).recovery === "string";

/**
 * Opens the cache of the watched repositories' threads, shared through
 * the cache folder by every docket process.
 *
 * Each repository is one TanStack Query query holding its `RepoCache`,
 * dated by when it was synced. The file is TanStack's dehydrated cache,
 * and loading it hydrates, which replaces a query's data only with newer
 * data, so a process never goes back to older threads.
 */
export default function createCache({
  provider,
  repos,
  directory,
  now,
}: CacheOptions): Cache {
  // A query no one observes is dropped after its garbage-collection time,
  // with a timer that would keep a text command running for minutes; the
  // cache keeps every query while the process lives.
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Number.POSITIVE_INFINITY } },
  });
  const file = join(directory, cacheFileName);
  const listeners = new Set<() => void>();
  let refreshing = false;
  let paused: CacheStatus["paused"];
  let failure: CacheStatus["failure"];

  const key = (repo: string) => ["snapshot", repo];
  const entry = (repo: string) => client.getQueryData<RepoCache>(key(repo));
  const store = (repo: string, value: RepoCache, at: Date) =>
    client.setQueryData(key(repo), value, { updatedAt: at.getTime() });
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const syncedAt = (): Date | undefined => {
    const times = repos.map(
      (repo) => client.getQueryState(key(repo))?.dataUpdatedAt ?? 0,
    );
    const oldest = Math.min(...times);
    return times.length > 0 && oldest > 0 ? new Date(oldest) : undefined;
  };
  const isFresh = (maxAge: number) => {
    const at = syncedAt();
    return at !== undefined && now().getTime() - at.getTime() < maxAge;
  };
  const threads = (): CachedThreads => ({
    threads: repos.flatMap((repo) => entry(repo)?.threads ?? []),
    syncedAt: syncedAt(),
  });

  const load = async () => {
    const state = await readCacheFile(file);
    if (state) hydrate(client, state);
    notify();
  };
  const save = () => writeCacheFile(file, dehydrate(client));

  /** Reads again the checks still running, on every repository at once. */
  const refreshChecks = async (synced: readonly RepoCache[]) => {
    if (!provider.capabilities().has("checks")) return [];
    const running = synced.flatMap(({ threads }) =>
      threads.filter(
        ({ kind, checks }) => kind === "pullRequest" && checks === "running",
      ),
    );
    return running.length === 0 ? [] : provider.refreshVolatile(running);
  };

  /**
   * Syncs every repository under the fetch lock, unless the data is
   * younger than `maxAge` once the lock is held: the process that held it
   * before may have fetched it.
   */
  const sync = (maxAge: number) =>
    withFetchLock(directory, async () => {
      await load();
      if (isFresh(maxAge)) return;
      refreshing = true;
      notify();
      try {
        // Every repository is dated from before its fetch, so the data is
        // never taken as newer than it is.
        const at = now();
        const synced = new Map<string, RepoCache>();
        for (const repo of repos) {
          const value = await syncRepo(provider, repo, entry(repo), at);
          synced.set(repo, value);
          store(repo, value, at);
          await save();
        }
        const refreshed = await refreshChecks([...synced.values()]);
        for (const [repo, value] of synced) {
          const threads = applyChecks(value.threads, refreshed);
          store(repo, { ...value, threads }, at);
        }
        await save();
      } finally {
        refreshing = false;
        notify();
      }
    });

  /**
   * Keeps a provider error in the status. A refusal for the rate limit
   * pauses the cycle until the budget resets, when the provider can say
   * when that is.
   */
  const record = async (error: unknown) => {
    if (!isProviderError(error)) throw error;
    if (error.code === "GITHUB_RATE_LIMITED") {
      const until = await provider.budget().then(
        ({ resetAt }) => resetAt,
        () => undefined,
      );
      if (until) {
        paused = { until, reason: "rateLimit" };
        return;
      }
    }
    failure = error;
  };

  return {
    threads,
    load,
    async read(maxAge) {
      await load();
      if (!isFresh(maxAge)) await sync(maxAge);
      return threads();
    },
    async refresh() {
      const at = now();
      if (paused && at < paused.until) return;
      try {
        const { limit, remaining, resetAt } = await provider.budget();
        if (at < resetAt && remaining < limit * budgetFloor) {
          paused = { until: resetAt, reason: "budget" };
        } else {
          await sync(refreshInterval);
          paused = undefined;
          failure = undefined;
        }
      } catch (error) {
        await record(error);
      }
      notify();
    },
    watch() {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const watcher = watchFolder(directory, (_event, name) => {
        if (name === cacheFileName) void load();
      });
      return () => watcher.close();
    },
    status: (): CacheStatus => ({
      syncedAt: syncedAt(),
      refreshing,
      paused,
      failure,
    }),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
