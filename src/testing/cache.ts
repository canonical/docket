/**
 * A cache held still, for the stories of the composed screen: it holds
 * the threads and the status it is given, and never loads or refreshes on
 * its own; only an editor's write changes it. It imports nothing from
 * vitest.
 */
import type {
  Cache,
  CachedEvents,
  CachedThreads,
  CacheStatus,
} from "../lib/cache/index.js";
import type { ThreadEvent } from "../lib/events/index.js";
import type { Provider } from "../lib/provider/index.js";
import type { Thread } from "../lib/waits/index.js";

/** Synced two minutes before `now`, with nothing under way. */
export function settleStatus(now: Date): CacheStatus {
  return {
    syncedAt: new Date(now.getTime() - 120_000),
    refreshing: false,
    fullRefresh: undefined,
    fullRefreshAvailableAt: undefined,
    paused: undefined,
    failure: undefined,
  };
}

/**
 * A cache holding `threads` with `status`, and `events` for each
 * repository they name, as synced at the status's `syncedAt`. An
 * assignment patched in shows on its thread until it is taken back, and
 * refreshing a repository, which a write does once GitHub answers, reads
 * its threads again from `github`'s snapshot when `github` is given.
 */
export function holdCache(
  threads: CachedThreads,
  status: CacheStatus,
  events: readonly ThreadEvent[] = [],
  github?: Pick<Provider, "snapshot">,
): Cache {
  const syncedAt = status.syncedAt ?? new Date(0);
  const findHeldEvents = (repo: string, since = new Date(0)): CachedEvents => ({
    events: events.filter(
      (event) => event.thread.repo === repo && event.at >= since,
    ),
    syncedAt,
  });
  let held = threads;
  let shown = threads;
  const patches = new Map<string, Thread["assignees"]>();
  const listeners = new Set<() => void>();
  // The screen reads the threads again only when told they changed, and
  // then only a new value counts as a change.
  const publish = () => {
    shown = {
      ...held,
      threads: held.threads.map((thread) => {
        const assignees = patches.get(`${thread.repo}#${thread.number}`);
        return assignees ? { ...thread, assignees } : thread;
      }),
    };
    for (const listener of listeners) listener();
  };
  return {
    threads: () => shown,
    load: async () => {},
    read: async () => shown,
    refreshRepo: async (repo) => {
      if (!github) return;
      const snapshot = await github.snapshot(repo, null);
      held = {
        ...held,
        threads: [
          ...held.threads.filter((thread) => thread.repo !== repo),
          ...snapshot.threads,
        ],
      };
      publish();
    },
    findEvents: findHeldEvents,
    readEvents: async (repo, since) => findHeldEvents(repo, since),
    readFile: async () => ({ text: undefined, syncedAt }),
    refresh: async () => {},
    fullRefresh: async () => {},
    watch: () => () => {},
    patchAssignees: ({ repo, number }, assignees) => {
      const id = `${repo}#${number}`;
      patches.set(id, assignees);
      publish();
      return () => {
        if (patches.get(id) !== assignees) return;
        patches.delete(id);
        publish();
      };
    },
    status: () => status,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
