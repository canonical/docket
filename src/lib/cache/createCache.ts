import { mkdirSync, watch as watchFolder } from "node:fs";
import { join } from "node:path";
import { dehydrate, hydrate, QueryClient } from "@tanstack/query-core";
import type { PageProgress, ProviderError } from "../provider/index.js";
import applyChecks from "./applyChecks.js";
import CacheError from "./CacheError.js";
import {
  budgetFloor,
  cacheFileName,
  fullRefreshCooldown,
  refreshInterval,
} from "./constants.js";
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

/**
 * Whether `error` is one a user can meet, from the provider or the cache
 * itself, with its code and recovery.
 */
const isNamedError = (error: unknown): error is ProviderError | CacheError =>
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
  let fullRefresh: CacheStatus["fullRefresh"];
  let fullRefreshAvailableAt: Date | undefined;
  let fullRefreshAt: Date | undefined;

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
    const contents = await readCacheFile(file);
    if (contents) {
      hydrate(client, contents.state);
      // Every write happens under the lock after a load, and carries the
      // start it loaded forward, so the file's is always the latest.
      fullRefreshAt = contents.fullRefreshAt ?? fullRefreshAt;
    }
    notify();
  };
  const save = () =>
    writeCacheFile(file, { state: dehydrate(client), fullRefreshAt });

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

  /** Fetches every repository, the lock held. */
  const fetchAll = async () => {
    refreshing = true;
    notify();
    try {
      // Every repository is dated from before its fetch, so the data is
      // never taken as newer than it is.
      const at = now();
      const synced = new Map<string, RepoCache>();
      for (const [index, repo] of repos.entries()) {
        const previous = entry(repo);
        // A repository with nothing to show is fetched whole while the
        // list waits for it, so its progress is reported.
        const onPage = previous
          ? undefined
          : (pages: PageProgress) => {
              fullRefresh = {
                repo,
                position: index + 1,
                count: repos.length,
                ...pages,
              };
              notify();
            };
        onPage?.({ fetched: 0, total: 0 });
        const value = await syncRepo(provider, repo, previous, at, onPage);
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
      fullRefresh = undefined;
      notify();
    }
  };

  /**
   * Syncs every repository under the fetch lock, unless the data is
   * younger than `maxAge` once the lock is held: the process that held it
   * before may have fetched it.
   */
  const sync = (maxAge: number) =>
    withFetchLock(directory, async () => {
      await load();
      if (!isFresh(maxAge)) await fetchAll();
    });

  /**
   * Throws the cached data away, here and in the file, and fetches
   * everything, under the fetch lock, unless a full refresh started within
   * `fullRefreshCooldown` in any process: the file says when the last
   * one started, and it is read once the lock is held.
   *
   * @returns Whether it fetched rather than being refused.
   */
  const discardAndFetch = () =>
    withFetchLock(directory, async () => {
      await load();
      const at = now();
      const available =
        (fullRefreshAt?.getTime() ?? Number.NEGATIVE_INFINITY) +
        fullRefreshCooldown;
      if (at.getTime() < available) {
        fullRefreshAvailableAt = new Date(available);
        return false;
      }
      fullRefreshAvailableAt = undefined;
      fullRefreshAt = at;
      client.clear();
      await save();
      await fetchAll();
      return true;
    });

  /**
   * Keeps what stopped a refresh in the status: a provider error or the
   * cache's own as it is, and any other, such as a full disk, as
   * `CACHE_REFRESH_FAILED`. A refusal for the rate limit pauses the cycle
   * until the budget resets, when the provider can say when that is.
   */
  const record = async (thrown: unknown) => {
    const error = isNamedError(thrown)
      ? thrown
      : new CacheError(
          "CACHE_REFRESH_FAILED",
          `docket could not refresh its cache (${String(thrown)}).`,
          `check that ${directory} has room and that you can write to it, then refresh`,
        );
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
    async fullRefresh() {
      try {
        if (await discardAndFetch()) {
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
      fullRefresh,
      fullRefreshAvailableAt,
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
