import type { Cursor, Provider } from "../provider/index.js";
import type { Thread } from "../waits/index.js";

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

/** The threads of every watched repository, and how old they are. */
export interface CachedThreads {
  readonly threads: readonly Thread[];
  /**
   * When the least recently synced repository was synced: the age of the
   * data as a whole. Absent while a repository has no data yet.
   */
  readonly syncedAt: Date | undefined;
}

/** What the faces show of the cache's own state, whatever the provider. */
export interface CacheStatus {
  /** When the data was last synced, as `CachedThreads` gives it. */
  readonly syncedAt: Date | undefined;
  /** True while a refresh fetches. */
  readonly refreshing: boolean;
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
 * The shared cache of the watched repositories' threads: one snapshot
 * query per repository, kept on disk for every docket process.
 */
export interface Cache {
  /** The threads held in memory, as last loaded or fetched. */
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
   */
  read(maxAge: number): Promise<CachedThreads>;
  status(): CacheStatus;
  /** Calls `listener` whenever the threads or the status change. */
  subscribe(listener: () => void): () => void;
}
