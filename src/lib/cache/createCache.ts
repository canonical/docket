import { mkdirSync, watch as watchFolder } from "node:fs";
import { join } from "node:path";
import { dehydrate, hydrate, QueryClient } from "@tanstack/query-core";
import type { Account } from "../people/index.js";
import type { Budgets } from "../provider/index.js";
import applyChecks from "./applyChecks.js";
import classifyFolderFailure from "./classifyFolderFailure.js";
import classifyRefreshFailure from "./classifyRefreshFailure.js";
import {
  cacheFileName,
  fullRefreshCooldown,
  idleInterval,
  refreshInterval,
} from "./constants.js";
import createBudgetRule from "./createBudgetRule.js";
import createReadQueries from "./createReadQueries.js";
import dropPages from "./dropPages.js";
import fetchRepos, { type FetchReposOptions } from "./fetchRepos.js";
import identifyFile from "./identifyFile.js";
import isSame from "./isSame.js";
import mergeBudgets from "./mergeBudgets.js";
import mergeSnapshot from "./mergeSnapshot.js";
import readCacheFile from "./readCacheFile.js";
import refreshChecks from "./refreshChecks.js";
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
 * Opens the cache of the watched repositories' threads, shared through
 * the cache folder by every docket process.
 *
 * Each repository is one TanStack Query query holding its `RepoCache`,
 * dated by when it was synced, one holding the events activity reads, and
 * one holding its own file, each dated by when it was fetched, and one
 * query holds the viewer's login, dated the same way. The file is
 * TanStack's dehydrated cache, and loading it hydrates, which replaces a
 * query's data only with newer data, so a process never goes back to
 * older threads.
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
  // The mirror of the budgets as the file last gave it or this process
  // last wrote it; this process's own answers join it on each read.
  let mirror: Budgets = {};
  const readFigures = () => mergeBudgets(mirror, provider.budget());

  const key = (repo: string) => ["snapshot", repo];
  const entry = (repo: string) => client.getQueryData<RepoCache>(key(repo));

  // Assignees set before GitHub answers, by thread: each holds only while
  // its repository's data is the copy it was made on, so any newer fetch
  // or load replaces it. They live apart from the queries, so no save
  // writes them to the file and no other process reads a set unconfirmed.
  const patches = new Map<
    string,
    { readonly held: RepoCache; readonly assignees: readonly Account[] }
  >();
  const patchKey = (repo: string, number: number) => `${repo}#${number}`;
  /** `repo`'s threads as held, each patch that still holds applied. */
  const listThreads = (repo: string) => {
    const held = entry(repo);
    return (held?.threads ?? []).map((thread) => {
      const patch = patches.get(patchKey(repo, thread.number));
      return patch && patch.held === held
        ? { ...thread, assignees: patch.assignees }
        : thread;
    });
  };
  const store = (repo: string, value: RepoCache, at: Date) =>
    client.setQueryData(key(repo), value, { updatedAt: at.getTime() });

  const queries = createReadQueries(client, now);

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
  let shownPatches = 0;
  let patchCount = 0;
  let status: CacheStatus = {
    syncedAt: undefined,
    refreshing: false,
    whole: false,
    stages: [],
    fullRefreshAvailableAt: undefined,
    paused: undefined,
    failure: undefined,
  };

  /**
   * Brings the status given out up to date with `change`, and the threads
   * with the queries unless `withThreads` is false, and tells the
   * listeners when either changed.
   */
  const publish = (change: Partial<CacheStatus> = {}, withThreads = true) => {
    const data = repos.map((repo) => {
      const state = client.getQueryState(key(repo));
      return { data: state?.data, at: state?.dataUpdatedAt ?? 0 };
    });
    const threadsChanged =
      withThreads &&
      (shownPatches !== patchCount ||
        data.some(
          (now, index) =>
            now.data !== shownData[index]?.data ||
            now.at !== shownData[index]?.at,
        ));
    if (threadsChanged) {
      shownData = data;
      shownPatches = patchCount;
      shown = {
        threads: repos.flatMap(listThreads),
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
      mirror = mergeBudgets(mirror, contents.budget);
    }
    publish();
    // Another process's answers may have taken the mirror below the floor.
    publishFloor();
  };
  const save = () => {
    mirror = readFigures();
    const contents = {
      state: dehydrate(client),
      fullRefreshAt,
      budget: mirror,
    };
    return writeCacheFile(file, contents, (id) => {
      written = id;
    });
  };

  const { judgeFloor, maySpend, publishFloor } = createBudgetRule({
    readFigures,
    now,
    status: () => status,
    // The threads are handed out once, when the run ends.
    publish: (change) => publish(change, false),
  });

  /**
   * Fetches every repository, the lock held, as `fetchRepos` does with
   * `options`, reporting each repository's stage.
   */
  const fetchAll = async (
    options: Pick<FetchReposOptions, "spend" | "reconcile" | "checks"> = {},
  ) => {
    // Nothing is shown until every repository holds data, so a run that
    // may spend and starts with one lacking fetches while the list waits.
    const whole = (options.spend?.() ?? true) && !syncedAt();
    // Every repository is dated from before its fetch, so the data is
    // never taken as newer than it is.
    const at = now();
    try {
      // The first report comes before any request, every repository
      // waiting, so the run and its stages are published together. The
      // threads are handed out once, when the run ends: each repository's
      // alone would rebuild every list on screen for each.
      await fetchRepos({
        provider,
        repos,
        at,
        find: entry,
        keep: (repo, value) => store(repo, value, at),
        report: (stages) => {
          // With rows on screen no page is drawn, so a report that moves
          // only the pages read would redraw the screen for nothing.
          const unseen =
            !whole &&
            status.refreshing &&
            isSame(dropPages(stages), dropPages(status.stages));
          if (!unseen) publish({ refreshing: true, whole, stages }, false);
        },
        ...options,
      });
    } finally {
      // Every other process reloads the file on each write, so a sync
      // writes it once, even when a repository fails, which keeps those
      // synced before it.
      await save();
      publish({ refreshing: false, whole: false });
    }
  };

  /**
   * Syncs every repository under the fetch lock, unless the data is
   * younger than `maxAge` once the lock is held: the process that held it
   * before may have fetched it. `options` are `fetchAll`'s.
   */
  const sync = (maxAge: number, options?: Parameters<typeof fetchAll>[0]) =>
    withFetchLock(directory, async () => {
      await load();
      if (!isFresh(maxAge)) await fetchAll(options);
    });

  /**
   * Throws the cached data away, here and in the file, and fetches
   * everything, under the fetch lock, unless a full refresh started within
   * `fullRefreshCooldown` in any process: the file says when the last
   * one started, and it is read once the lock is held. `discarded` hears
   * when the data is thrown away, before the fetch, which may fail.
   */
  const discardAndFetch = (discarded: () => void) =>
    withFetchLock(directory, async () => {
      await load();
      const at = now();
      const available =
        (fullRefreshAt?.getTime() ?? Number.NEGATIVE_INFINITY) +
        fullRefreshCooldown;
      if (at.getTime() < available) {
        publish({ fullRefreshAvailableAt: new Date(available) });
        return;
      }
      publish({ fullRefreshAvailableAt: undefined });
      fullRefreshAt = at;
      client.clear();
      discarded();
      // The threads thrown away leave the screen at once, not once the
      // fetch that replaces them ends.
      publish();
      await save();
      await fetchAll();
    });

  /**
   * What `find` gives from the data held, loaded from the file first.
   * Otherwise `fetch` fetches it under the fetch lock, unless the process
   * that held the lock before already did, keeps it in the queries, and
   * the file then gives it to every process.
   */
  const readThrough = async <Held>(
    find: () => Held | undefined,
    fetch: (at: Date) => Promise<Held>,
  ): Promise<Held> => {
    try {
      await load();
      const cached = find();
      if (cached) return cached;
      return await withFetchLock(directory, async () => {
        // The process that held the lock before may have fetched it.
        await load();
        const fetched = find();
        if (fetched) return fetched;
        // Dated from before the fetch, so it is never taken as newer than
        // it is.
        const held = await fetch(now());
        await save();
        return held;
      });
    } catch (error) {
      throw classifyFolderFailure(error, directory);
    }
  };

  return {
    threads: () => shown,
    load,
    findEvents: queries.findEvents,
    readEvents: (repo, since, maxAge) =>
      readThrough(
        () => queries.findFreshEvents(repo, since, maxAge),
        async (at) => {
          const events = await provider.events(repo, since);
          queries.keepEvents(repo, since, events, at);
          return { events, syncedAt: at };
        },
      ),
    readFile: (repo, path, maxAge) =>
      readThrough(
        () => queries.findFreshFile(repo, path, maxAge),
        async (at) => {
          const text = await provider.readFile(repo, path);
          queries.keepFile(repo, path, text, at);
          return { text, syncedAt: at };
        },
      ),
    readViewer: (maxAge) =>
      readThrough(
        () => queries.findFreshViewer(maxAge),
        async (at) => {
          const login = await provider.viewer();
          queries.keepViewer(login, at);
          return { login, syncedAt: at };
        },
      ),
    async refreshIfChanged(repo) {
      const at = now();
      const { paused } = status;
      if (paused?.reason === "rateLimit" && at < paused.until) return false;
      if (!provider.capabilities().has("changeProbe")) return false;
      try {
        return await withFetchLock(directory, async () => {
          await load();
          const previous = entry(repo);
          if (!previous) return false;
          const value = await syncRepo(provider, repo, previous, at, {
            spend: maySpend(),
            reconcile: false,
          });
          // Unchanged, the repository keeps its data, and its tag, which
          // GitHub still answers "not modified".
          publishFloor();
          if (!value || value.threads === previous.threads) return false;
          store(repo, value, at);
          await save();
          publish();
          return true;
        });
      } catch (error) {
        throw classifyFolderFailure(error, directory);
      }
    },
    async refreshRepo(repo) {
      try {
        await withFetchLock(directory, async () => {
          await load();
          const previous = entry(repo);
          // With nothing held, the next read fetches the repository whole.
          if (!previous) return;
          // Dated from before the fetch, so it is never taken as newer
          // than it is. No free check for changes runs first: the caller
          // knows a thread changed, and the check can lag behind a write.
          const at = now();
          const changed = await provider.snapshot(repo, previous.cursor);
          const value = {
            ...previous,
            threads: mergeSnapshot(previous.threads, changed.threads),
            cursor: changed.cursor,
          };
          const refreshed = await refreshChecks(provider, [value]);
          store(
            repo,
            { ...value, threads: applyChecks(value.threads, refreshed) },
            at,
          );
          await save();
          publish();
        });
      } catch (error) {
        throw classifyFolderFailure(error, directory);
      }
    },
    async read(maxAge) {
      try {
        await load();
        if (!isFresh(maxAge)) {
          await sync(maxAge);
        }
        return shown;
      } catch (error) {
        throw classifyFolderFailure(error, directory);
      }
    },
    async refresh(attention = "active") {
      const at = now();
      const { paused } = status;
      if (paused && at < paused.until && paused.reason === "rateLimit") return;
      // A pause whose time is past no longer holds, and the floor as the
      // mirror stands is in force from the start of the run.
      publishFloor();
      try {
        const idle = attention === "idle";
        // Waking catches up at once, whatever another pane fetched.
        const maxAge =
          attention === "waking" ? 0 : idle ? idleInterval : refreshInterval;
        // Below the floor the free checks still run, so the data a check
        // finds unchanged stays current and a change waits for the reset.
        // The floor is judged before each repository and before the checks.
        await sync(maxAge, {
          spend: () => maySpend(),
          reconcile: !idle,
          checks: !idle,
        });
        publish({ paused: judgeFloor(), failure: undefined });
      } catch (error) {
        publish(classifyRefreshFailure(error, readFigures()));
      }
    },
    async fullRefresh() {
      let discarded = false;
      try {
        await discardAndFetch(() => {
          discarded = true;
        });
        if (discarded) publish({ paused: judgeFloor(), failure: undefined });
      } catch (error) {
        publish(classifyRefreshFailure(error, readFigures()));
      }
      return discarded;
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
    patchAssignees({ repo, number }, assignees) {
      const held = entry(repo);
      if (!held) return () => {};
      const id = patchKey(repo, number);
      const patch = { held, assignees };
      patches.set(id, patch);
      patchCount++;
      publish();
      return () => {
        if (patches.get(id) !== patch) return;
        patches.delete(id);
        patchCount++;
        publish();
      };
    },
    budget: readFigures,
    maySpend,
    async keepBudget() {
      // This process's own answers can take the mirror below the floor.
      publishFloor();
      try {
        // GitHub counts every request of the account against one budget,
        // so while another process holds the lock, its own next answers
        // report this spending too: nothing waits for it.
        await withFetchLock(
          directory,
          async () => {
            await load();
            // Only figures the file lacks are worth a write every process
            // reloads.
            if (!isSame(readFigures(), mirror)) await save();
          },
          () => undefined,
        );
      } catch (error) {
        throw classifyFolderFailure(error, directory);
      }
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
