import { mkdirSync, watch as watchFolder } from "node:fs";
import { join } from "node:path";
import { dehydrate, hydrate, QueryClient } from "@tanstack/query-core";
import type { PageProgress, ProviderError } from "../provider/index.js";
import applyChecks from "./applyChecks.js";
import CacheError from "./CacheError.js";
import classifyFolderFailure from "./classifyFolderFailure.js";
import {
  budgetFloor,
  cacheFileName,
  fullRefreshCooldown,
  refreshInterval,
} from "./constants.js";
import identifyFile from "./identifyFile.js";
import isSame from "./isSame.js";
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
  let fullRefreshAt: Date | undefined;
  // The file this process wrote last, as identifyFile names it.
  let written: string | undefined;

  const key = (repo: string) => ["snapshot", repo];
  const entry = (repo: string) => client.getQueryData<RepoCache>(key(repo));
  const store = (repo: string, value: RepoCache, at: Date) =>
    client.setQueryData(key(repo), value, { updatedAt: at.getTime() });

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

  // The threads and the status given out. Each is replaced only when
  // something in it changes, because a face reads them through React's
  // useSyncExternalStore, which needs the same value back until then.
  let shown: CachedThreads = { threads: [], syncedAt: undefined };
  let shownData = repos.map(() => ({ data: undefined as unknown, at: 0 }));
  let status: CacheStatus = {
    syncedAt: undefined,
    refreshing: false,
    fullRefresh: undefined,
    fullRefreshAvailableAt: undefined,
    paused: undefined,
    failure: undefined,
  };

  /**
   * Brings the threads and the status given out up to date with the
   * queries and with `change`, and tells the listeners when either
   * changed.
   */
  const publish = (change: Partial<CacheStatus> = {}) => {
    const data = repos.map((repo) => {
      const state = client.getQueryState(key(repo));
      return { data: state?.data, at: state?.dataUpdatedAt ?? 0 };
    });
    const threadsChanged = data.some(
      (now, index) =>
        now.data !== shownData[index]?.data || now.at !== shownData[index]?.at,
    );
    if (threadsChanged) {
      shownData = data;
      shown = {
        threads: repos.flatMap((repo) => entry(repo)?.threads ?? []),
        syncedAt: syncedAt(),
      };
    }
    const next = { ...status, ...change, syncedAt: shown.syncedAt };
    const statusChanged = !isSame(next, status);
    if (statusChanged) status = next;
    if (threadsChanged || statusChanged) {
      for (const listener of listeners) listener();
    }
  };

  const load = async () => {
    const contents = await readCacheFile(file);
    if (contents) {
      hydrate(client, contents.state);
      // Every write happens under the lock after a load, and carries the
      // start it loaded forward, so the file's is always the latest.
      fullRefreshAt = contents.fullRefreshAt ?? fullRefreshAt;
    }
    publish();
  };
  const save = () =>
    writeCacheFile(file, { state: dehydrate(client), fullRefreshAt }, (id) => {
      written = id;
    });

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
    publish({ refreshing: true });
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
          : (pages: PageProgress) =>
              publish({
                fullRefresh: {
                  repo,
                  position: index + 1,
                  count: repos.length,
                  ...pages,
                },
              });
        onPage?.({ fetched: 0, total: 0 });
        const value = await syncRepo(provider, repo, previous, at, onPage);
        synced.set(repo, value);
        store(repo, value, at);
      }
      const refreshed = await refreshChecks([...synced.values()]);
      for (const [repo, value] of synced) {
        const threads = applyChecks(value.threads, refreshed);
        store(repo, { ...value, threads }, at);
      }
    } finally {
      // Every other process reloads the file on each write, so a sync
      // writes it once, even when a repository fails, which keeps those
      // synced before it.
      await save();
      publish({ refreshing: false, fullRefresh: undefined });
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
        publish({ fullRefreshAvailableAt: new Date(available) });
        return false;
      }
      publish({ fullRefreshAvailableAt: undefined });
      fullRefreshAt = at;
      client.clear();
      await save();
      await fetchAll();
      return true;
    });

  /**
   * Keeps what stopped a refresh in the status: a provider error or the
   * cache's own as it is, and any other, such as a full disk or an answer
   * cut short, as `CACHE_REFRESH_FAILED`. That code covers causes that
   * need different steps, so it names the cause and gives a step that
   * holds for each. The message ends as a sentence, as every message
   * does: a full stop follows a cause that ends in none of `.`, `?` or
   * `!`, and a cause with no text leaves the message's own sentence
   * alone. A refusal for the rate limit pauses the cycle until the budget
   * resets, when the provider can say when that is.
   */
  const record = async (thrown: unknown): Promise<Partial<CacheStatus>> => {
    const cause = thrown instanceof Error ? thrown.message : String(thrown);
    const error = isNamedError(thrown)
      ? thrown
      : new CacheError(
          "CACHE_REFRESH_FAILED",
          cause === ""
            ? "docket could not refresh its cache."
            : `docket could not refresh its cache: ${/[.?!]$/.test(cause) ? cause : `${cause}.`}`,
          "refresh again",
        );
    if (error.code === "GITHUB_RATE_LIMITED") {
      const until = await provider.budget().then(
        ({ resetAt }) => resetAt,
        () => undefined,
      );
      if (until) return { paused: { until, reason: "rateLimit" } } as const;
    }
    return { failure: error };
  };

  return {
    threads: () => shown,
    load,
    async read(maxAge) {
      try {
        await load();
        if (!isFresh(maxAge)) await sync(maxAge);
        return shown;
      } catch (error) {
        throw classifyFolderFailure(error, directory);
      }
    },
    async refresh() {
      const at = now();
      if (status.paused && at < status.paused.until) return;
      try {
        const { limit, remaining, resetAt } = await provider.budget();
        if (at < resetAt && remaining < limit * budgetFloor) {
          publish({ paused: { until: resetAt, reason: "budget" } });
        } else {
          await sync(refreshInterval);
          publish({ paused: undefined, failure: undefined });
        }
      } catch (error) {
        publish(await record(error));
      }
    },
    async fullRefresh() {
      try {
        if (await discardAndFetch()) {
          publish({ paused: undefined, failure: undefined });
        }
      } catch (error) {
        publish(await record(error));
      }
    },
    watch() {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const watcher = watchFolder(directory, (_event, name) => {
        if (name !== cacheFileName) return;
        // The file this process wrote holds nothing it lacks.
        void identifyFile(file).then((found) =>
          found === written ? undefined : load(),
        );
      });
      return () => watcher.close();
    },
    status: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
