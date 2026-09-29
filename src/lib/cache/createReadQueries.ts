import type { QueryClient } from "@tanstack/query-core";
import type { ThreadEvent } from "../events/index.js";
import type {
  CachedEvents,
  CachedFile,
  CachedViewer,
  EventsCache,
  FileCache,
} from "./types.js";

/**
 * The queries in `client` that hold what the cache reads on demand, beside
 * the repositories' threads: the events and each file of a repository, and
 * the login gh is signed in with, which a text command reads on every
 * call. Each is dated by when it was fetched, and is fresh while younger,
 * by `now`, than the maximum age a read asks for.
 *
 * @note Impure: reads and writes `client`'s queries.
 */
export default function createReadQueries(
  client: QueryClient,
  now: () => Date,
) {
  const eventsKey = (repo: string) => ["events", repo];
  const fileKey = (repo: string, path: string) => ["file", repo, path];
  const viewerKey = ["viewer"];
  const isYounger = (syncedAt: Date, maxAge: number) =>
    now().getTime() - syncedAt.getTime() < maxAge;

  /**
   * The events held for `repo` from `since` on, when they reach back to it;
   * without `since`, every event held.
   */
  const findEvents = (repo: string, since?: Date): CachedEvents | undefined => {
    const state = client.getQueryState<EventsCache>(eventsKey(repo));
    const held = state?.data;
    if (!state || !held) return undefined;
    const from = since ?? held.since;
    if (held.since > from) return undefined;
    return {
      events: held.events.filter(({ at }) => at >= from),
      syncedAt: new Date(state.dataUpdatedAt),
    };
  };

  return {
    findEvents,
    /** The events held for `repo` from `since` on, younger than `maxAge`. */
    findFreshEvents(repo: string, since: Date, maxAge: number) {
      const held = findEvents(repo, since);
      return held && isYounger(held.syncedAt, maxAge) ? held : undefined;
    },
    /** The file held for `repo` at `path`, when it is younger than `maxAge`. */
    findFreshFile(
      repo: string,
      path: string,
      maxAge: number,
    ): CachedFile | undefined {
      const state = client.getQueryState<FileCache>(fileKey(repo, path));
      if (state?.data === undefined) return undefined;
      const syncedAt = new Date(state.dataUpdatedAt);
      return isYounger(syncedAt, maxAge)
        ? { text: state.data.text ?? undefined, syncedAt }
        : undefined;
    },
    /** The viewer's login held, when it is younger than `maxAge`. */
    findFreshViewer(maxAge: number): CachedViewer | undefined {
      const state = client.getQueryState<string>(viewerKey);
      if (state?.data === undefined) return undefined;
      const syncedAt = new Date(state.dataUpdatedAt);
      return isYounger(syncedAt, maxAge)
        ? { login: state.data, syncedAt }
        : undefined;
    },
    /** Keeps the events on `repo`'s threads from `since` on, fetched `at`. */
    keepEvents(
      repo: string,
      since: Date,
      events: readonly ThreadEvent[],
      at: Date,
    ) {
      const value: EventsCache = { since, events };
      client.setQueryData(eventsKey(repo), value, { updatedAt: at.getTime() });
    },
    /** Keeps the file at `path` on `repo`, or its absence, fetched `at`. */
    keepFile(repo: string, path: string, text: string | undefined, at: Date) {
      const value: FileCache = { text: text ?? null };
      client.setQueryData(fileKey(repo, path), value, {
        updatedAt: at.getTime(),
      });
    },
    /** Keeps the viewer's login, fetched `at`. */
    keepViewer(login: string, at: Date) {
      client.setQueryData(viewerKey, login, { updatedAt: at.getTime() });
    },
  };
}
