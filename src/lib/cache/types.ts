import type { DehydratedState } from "@tanstack/query-core";
import type { ThreadEvent } from "../events/index.js";
import type { Account } from "../people/index.js";
import type {
  Cursor,
  PageProgress,
  Provider,
  ProviderError,
} from "../provider/index.js";
import type { Thread } from "../waits/index.js";
import type CacheError from "./CacheError.js";

/**
 * The named codes of the cache's own errors. This is the one list of
 * them. Callers and scripts depend on the codes, so a code is never
 * renamed or reused.
 */
export type CacheErrorCode =
  | "CACHE_LOCK_TIMED_OUT"
  | "CACHE_REFRESH_FAILED"
  /** The cache folder cannot be made, read or written. */
  | "CACHE_UNUSABLE";

/** What the cache keeps for one repository. */
export interface RepoCache {
  /** The open threads. */
  readonly threads: readonly Thread[];
  /** Where the next snapshot since a cursor starts. */
  readonly cursor: Cursor | null;
  /** What the next check for changes passes, when the provider has one. */
  readonly tag: string | undefined;
  /** When every thread was last fetched, rather than those since a cursor. */
  readonly reconciledAt: Date;
}

/** What the cache keeps of one repository's events. */
export interface EventsCache {
  /** How far back the events reach: every event at or after it is held. */
  readonly since: Date;
  readonly events: readonly ThreadEvent[];
}

/**
 * What the cache keeps of one file of a repository: its text, or `null`
 * when the repository has none there. The cache file is JSON, which has
 * no `undefined`.
 */
export interface FileCache {
  readonly text: string | null;
}

/** What the cache file holds, for every docket process. */
export interface CacheFile {
  /** TanStack Query's dehydrated cache: one query per repository. */
  readonly state: DehydratedState;
  /**
   * When the last full refresh started, in whichever process, so its
   * cooldown holds across processes. Absent before the first.
   */
  readonly fullRefreshAt: Date | undefined;
}

/** The threads of every watched repository, and how old they are. */
export interface CachedThreads {
  readonly threads: readonly Thread[];
  /**
   * When the least recently synced repository was synced: the age of the
   * data as a whole. Absent while a repository has no data yet.
   */
  readonly syncedAt: Date | undefined;
}

/** The events of one repository, and when they were fetched. */
export interface CachedEvents {
  readonly events: readonly ThreadEvent[];
  readonly syncedAt: Date;
}

/** One file of a repository, and when it was fetched. */
export interface CachedFile {
  /** The file's text, or `undefined` when the repository has none there. */
  readonly text: string | undefined;
  readonly syncedAt: Date;
}

/** The login gh is signed in with, and when it was fetched. */
export interface CachedViewer {
  readonly login: string;
  readonly syncedAt: Date;
}

/**
 * How far fetching every repository whole has come, while nothing is
 * shown for it: on the first run, or after a full refresh. The pages are
 * those of the repository being fetched, 0 of 0 until its first page.
 */
export interface FullRefreshProgress extends PageProgress {
  readonly repo: string;
  /** Its place in the list of repositories, from 1. */
  readonly position: number;
  /** How many repositories the list holds. */
  readonly count: number;
}

/** What the faces show of the cache's own state, whatever the provider. */
export interface CacheStatus {
  /** When the data was last synced, as `CachedThreads` gives it. */
  readonly syncedAt: Date | undefined;
  /** True while a refresh fetches. */
  readonly refreshing: boolean;
  /** The progress of fetching everything, while nothing is shown. */
  readonly fullRefresh: FullRefreshProgress | undefined;
  /** When a full refresh is available again, after one was refused. */
  readonly fullRefreshAvailableAt: Date | undefined;
  /**
   * Until when the refresh cycle pauses, and why: the budget ran low, and
   * only the free checks for changes run, or the provider refused a
   * request for its rate limit, and nothing runs.
   */
  readonly paused:
    | { readonly until: Date; readonly reason: "budget" | "rateLimit" }
    | undefined;
  /**
   * What stopped the last refresh, such as no answer from the network. The
   * threads fetched before stay, and `syncedAt` gives their age.
   */
  readonly failure: ProviderError | CacheError | undefined;
}

/** Where the cache keeps its data, and where it fetches it from. */
export interface CacheOptions {
  /** The only way to the data: the cache knows no provider behind it. */
  readonly provider: Provider;
  /** The watched repositories, as `owner/name`. */
  readonly repos: readonly string[];
  /** The cache folder, which other docket processes share. */
  readonly directory: string;
  /** The current time, read whenever an age is measured. */
  readonly now: () => Date;
}

/**
 * The shared cache of the watched repositories' threads, events and own
 * files: one snapshot query, one events query and one query per file for
 * each repository, and one query for the viewer's login, kept on disk
 * for every docket process.
 */
export interface Cache {
  /**
   * The threads held in memory, as last loaded or fetched: the same value
   * on every call until they change.
   */
  threads(): CachedThreads;
  /**
   * Loads what other processes wrote to the cache file, keeping only data
   * newer than what is held.
   */
  load(): Promise<void>;
  /**
   * The threads, no older than `maxAge` milliseconds. Older data is
   * synced under the fetch lock, unless the process that held it before
   * already did.
   *
   * @throws ProviderError when the provider fails.
   * @throws CacheError `CACHE_LOCK_TIMED_OUT` when another process holds
   * the fetch lock for longer than the wait allows, and `CACHE_UNUSABLE`
   * when the cache folder cannot be made, read or written.
   */
  read(maxAge: number): Promise<CachedThreads>;
  /**
   * Brings `repo`'s threads up to date at once, whatever their age: each
   * thread changed since the last sync replaces its copy, under the fetch
   * lock, and the cache file gives it to every docket process. A write
   * calls it for the repository of the thread it changed. A repository
   * with nothing held is left for the next read to fetch whole.
   *
   * @throws ProviderError when the provider fails.
   * @throws CacheError `CACHE_LOCK_TIMED_OUT` when another process holds
   * the fetch lock for longer than the wait allows, and `CACHE_UNUSABLE`
   * when the cache folder cannot be made, read or written.
   */
  refreshRepo(repo: string): Promise<void>;
  /**
   * The events held for `repo` at or after `since`, however old, as last
   * loaded or fetched; nothing when those held do not reach back to
   * `since`. Without `since`, every event held, however far back they
   * reach; nothing when none are held.
   */
  findEvents(repo: string, since?: Date): CachedEvents | undefined;
  /**
   * The events on `repo`'s threads at or after `since`, no older than
   * `maxAge` milliseconds. Otherwise they are fetched under the fetch
   * lock, unless the process that held it before already did, and kept
   * in the cache file for every docket process.
   *
   * @throws ProviderError when the provider fails.
   * @throws CacheError `CACHE_LOCK_TIMED_OUT` when another process holds
   * the fetch lock for longer than the wait allows, and `CACHE_UNUSABLE`
   * when the cache folder cannot be made, read or written.
   */
  readEvents(repo: string, since: Date, maxAge: number): Promise<CachedEvents>;
  /**
   * The file at `path` on `repo`'s default branch, or its absence, no
   * older than `maxAge` milliseconds. Otherwise it is read under the
   * fetch lock, unless the process that held it before already did, and
   * kept in the cache file for every docket process.
   *
   * @throws ProviderError when the provider fails.
   * @throws CacheError `CACHE_LOCK_TIMED_OUT` when another process holds
   * the fetch lock for longer than the wait allows, and `CACHE_UNUSABLE`
   * when the cache folder cannot be made, read or written.
   */
  readFile(repo: string, path: string, maxAge: number): Promise<CachedFile>;
  /**
   * The login gh is signed in with, no older than `maxAge` milliseconds.
   * Otherwise it is read under the fetch lock, unless the process that
   * held it before already did, and kept in the cache file for every
   * docket process.
   *
   * @throws ProviderError when the provider fails.
   * @throws CacheError `CACHE_LOCK_TIMED_OUT` when another process holds
   * the fetch lock for longer than the wait allows, and `CACHE_UNUSABLE`
   * when the cache folder cannot be made, read or written.
   */
  readViewer(maxAge: number): Promise<CachedViewer>;
  /**
   * One step of the refresh cycle: syncs data older than the refresh
   * interval, unless the provider refused a request for its rate limit.
   * While the budget is low it spends none of it: only the free checks
   * for changes run, until the budget resets. It never
   * throws: whatever stops it is kept in the status, a provider error or
   * a wait for the fetch lock that runs out with its own code, and any
   * other, such as a full disk, as `CACHE_REFRESH_FAILED`.
   */
  refresh(): Promise<void>;
  /**
   * Discards the cached data, here and in the file, and fetches every
   * repository whole, reporting its progress in the status. One is
   * refused within `fullRefreshCooldown` of the last, in any process,
   * checked under the fetch lock so two asked together fetch once, and
   * the status then
   * says when one is available. It never throws: whatever stops it is
   * kept in the status, as `refresh` keeps it.
   */
  fullRefresh(): Promise<void>;
  /**
   * Reloads the cache whenever another process writes it, watching the
   * cache folder: the file itself is replaced on every write.
   *
   * @returns Stops watching.
   */
  watch(): () => void;
  /**
   * Shows `assignees` as the thread's set at once, before GitHub answers a
   * write of it: in this process's memory only, never in the cache file,
   * so no other process reads a set GitHub has not confirmed. The data
   * keeps its date, so any newer fetch or load replaces the patch, and the
   * listeners hear of it. A thread whose repository holds nothing yet is
   * left alone.
   *
   * @returns Takes the patch back, unless a newer one replaced it.
   */
  patchAssignees(
    thread: Pick<Thread, "repo" | "number">,
    assignees: readonly Account[],
  ): () => void;
  /** The cache's state: the same value on every call until it changes. */
  status(): CacheStatus;
  /** Calls `listener` whenever the threads or the status change. */
  subscribe(listener: () => void): () => void;
}
