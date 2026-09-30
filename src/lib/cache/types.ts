import type { DehydratedState } from "@tanstack/query-core";
import type { ThreadEvent } from "../events/index.js";
import type { Account } from "../people/index.js";
import type {
  Budgets,
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
 * Where one repository is in a refresh: `waiting` for its turn;
 * `checking` for changes with the free check; `reading` its threads,
 * with the pages of a whole fetch, 0 of 0 until the first and for a
 * fetch since its cursor; `checks`, while the checks still running are
 * read again; `done`, with the open threads it holds; `paused`, for the
 * budget when it is low and the repository needs points to go on, or
 * for the rate limit when the provider refused the refresh for it,
 * which pauses the repository it stopped on and every one after it; or
 * `failed`, when any other failure stopped the refresh on it, with the
 * error that stopped it, named as the status names a failure: the
 * stage's own error is the reason, whatever failure the status holds.
 * `checks` and `done` keep the pages its read reached, 0 of 0 when it
 * read none, so the figure a refresh reached holds while it goes on.
 */
export type RepoStage =
  | { readonly kind: "waiting" }
  | { readonly kind: "checking" }
  | ({ readonly kind: "reading" } & PageProgress)
  | ({ readonly kind: "checks" } & PageProgress)
  | ({ readonly kind: "done"; readonly threads: number } & PageProgress)
  | { readonly kind: "paused"; readonly reason: "budget" | "rateLimit" }
  | { readonly kind: "failed"; readonly error: ProviderError | CacheError };

/** One watched repository, as `owner/name`, and its stage. */
export interface RepoProgress {
  readonly repo: string;
  readonly stage: RepoStage;
}

/** What the faces show of the cache's own state, whatever the provider. */
export interface CacheStatus {
  /** When the data was last synced, as `CachedThreads` gives it. */
  readonly syncedAt: Date | undefined;
  /** True while a refresh fetches. */
  readonly refreshing: boolean;
  /**
   * Whether the refresh under way fetches every repository whole while
   * nothing is shown: on the first run, or after a full refresh.
   */
  readonly whole: boolean;
  /**
   * Each watched repository's stage in the last refresh this process ran,
   * in the watched order: kept once it ends, so a refresh that stopped
   * shows where. Empty before the first.
   */
  readonly stages: readonly RepoProgress[];
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

/**
 * Whether anyone is using a terminal pane, which sets how the refresh
 * cycle runs: `active` while a key was pressed within `idleAfter`;
 * `idle` after that; and `waking` from the first key after that until
 * the cycle has caught up.
 */
export type AttentionState = "active" | "idle" | "waking";

/** The attention of one terminal pane. */
export interface Attention {
  /** The pane's state: the same value on every call until it changes. */
  state(): AttentionState;
  /** A key was pressed: it keeps the pane active, or wakes an idle one. */
  press(): void;
  /** The refresh cycle has caught up after waking: the pane is active. */
  settle(): void;
  /** Calls `listener` whenever the state changes. */
  subscribe(listener: () => void): () => void;
  /** Stops the timer that turns the pane idle, when the pane closes. */
  stop(): void;
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
   * Runs the free check for changes on `repo`, and only when it sees a
   * change, fetches the threads changed since the last sync, under the
   * fetch lock, for every docket process: the selected thread's
   * repository, checked often and at no cost while nothing changes. It
   * spends nothing while the budget is low, and asks nothing while the
   * provider refuses requests for its rate limit, has no free check, or
   * while the repository holds nothing yet.
   *
   * @returns Whether it fetched a change.
   * @throws ProviderError when the provider fails.
   * @throws CacheError `CACHE_LOCK_TIMED_OUT` when another process holds
   * the fetch lock for longer than the wait allows, and `CACHE_UNUSABLE`
   * when the cache folder cannot be made, read or written.
   */
  refreshIfChanged(repo: string): Promise<boolean>;
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
   * One step of the refresh cycle, as `attention` sets it, unless the
   * provider refused a request for its rate limit. `active`, the default,
   * syncs data older than the refresh interval, with the checks refresh
   * and the whole hourly fetch when it is due; `idle` syncs data older
   * than the idle interval, without the checks refresh, and leaves the
   * whole fetch until the pane wakes; `waking` syncs at once, as
   * `active` does. While the budget is low it spends none of it: only
   * the free checks for changes run, until the budget resets. It never
   * throws: whatever stops it is kept in the status, a provider error or
   * a wait for the fetch lock that runs out with its own code, and any
   * other, such as a full disk, as `CACHE_REFRESH_FAILED`.
   */
  refresh(attention?: AttentionState): Promise<void>;
  /**
   * Discards the cached data, here and in the file, and fetches every
   * repository whole, reporting its progress in the status. One is
   * refused within `fullRefreshCooldown` of the last, in any process,
   * checked under the fetch lock so two asked together fetch once, and
   * the status then says when one is available. It never throws: whatever
   * stops it is kept in the status, as `refresh` keeps it.
   *
   * @returns Whether it threw the data away, rather than being refused,
   * whether or not the fetch after it succeeded.
   */
  fullRefresh(): Promise<boolean>;
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
  /**
   * The mirror of the provider's budgets: for each kind, the latest
   * report any docket process heard, as the budget file last gave it, or
   * this process's own answers heard since, whichever is later.
   */
  readBudgets(): Budgets;
  /**
   * Whether docket may spend points of its own at the time asked, judged
   * on the mirror: false below the budget floor, the share of the hourly
   * budget kept for the user's own requests, until the queries' budget
   * resets. It writes nothing. docket's own background spending asks it
   * before each request: the refresh cycle, reading details ahead of the
   * selection, the watch of the selected thread's repository, and reading
   * activity's events again at a sync.
   * What the user or an agent asks for directly never asks, and still
   * spends from the reserve: the selected thread's details, a full
   * refresh, `show`, the read after a write, the read of the viewer on
   * opening, the first read of an activity window, and every text command.
   */
  maySpend(): boolean;
  /**
   * Merges the budgets this process heard into the budget file,
   * `budget.json` beside the cache file, under that file's own lock and
   * never the fetch lock, so every docket process judges the floor on
   * them: after a read of details, and after each save of the cache. Of
   * each kind the later report stays, so an older figure never overwrites
   * a newer one. It gives the status the floor at once, returns at once
   * when this process heard nothing since it last read or wrote the file,
   * and a call made while one runs joins it. It never fails: a keeping
   * that cannot read, lock or write the file is dropped, and the next
   * keeping carries the figures.
   */
  keepBudget(): Promise<void>;
  /** The cache's state: the same value on every call until it changes. */
  status(): CacheStatus;
  /** Calls `listener` whenever the threads or the status change. */
  subscribe(listener: () => void): () => void;
}
