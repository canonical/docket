/**
 * A cache held still, for the stories of the composed screen: it holds
 * the threads and the status it is given, and never fetches, loads or
 * changes. It imports nothing from vitest.
 */
import type {
  Cache,
  CachedEvents,
  CachedThreads,
  CacheStatus,
} from "../lib/cache/index.js";
import type { ThreadEvent } from "../lib/events/index.js";

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
 * repository they name, as synced at the status's `syncedAt`.
 */
export function holdCache(
  threads: CachedThreads,
  status: CacheStatus,
  events: readonly ThreadEvent[] = [],
): Cache {
  const syncedAt = status.syncedAt ?? new Date(0);
  const findHeldEvents = (repo: string, since = new Date(0)): CachedEvents => ({
    events: events.filter(
      (event) => event.thread.repo === repo && event.at >= since,
    ),
    syncedAt,
  });
  return {
    threads: () => threads,
    load: async () => {},
    read: async () => threads,
    refreshRepo: async () => {},
    findEvents: findHeldEvents,
    readEvents: async (repo, since) => findHeldEvents(repo, since),
    readFile: async () => ({ text: undefined, syncedAt }),
    refresh: async () => {},
    fullRefresh: async () => {},
    watch: () => () => {},
    patchAssignees: () => () => {},
    status: () => status,
    subscribe: () => () => {},
  };
}
