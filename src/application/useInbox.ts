import { useEffect, useState, useSyncExternalStore } from "react";
import type { AttentionState, CacheError } from "../lib/cache/index.js";
import type {
  InboxFilter,
  InboxGrouping,
  InboxList,
} from "../lib/inbox/index.js";
import { listInbox } from "../lib/inbox/index.js";
import type { PageProgress, ProviderError } from "../lib/provider/index.js";
import type { Problem } from "../lib/text/index.js";
import describeFailure from "./describeFailure.js";
import isNamedError from "./isNamedError.js";
import type { TerminalView, Watched } from "./types.js";

/** Props for the useInbox hook. */
export interface UseInboxProps {
  readonly source: TerminalView["source"];
  /** Whether the inbox is on screen, which is when it reads again. */
  readonly shown: boolean;
  /**
   * The pane's attention: an idle pane reads nothing, and a key wakes it
   * into a read.
   */
  readonly attention?: AttentionState;
  /** When the cache last synced, which triggers the read of the mode shown. */
  readonly syncedAt: Date | undefined;
  readonly watched: readonly Watched[];
  readonly grouping: InboxGrouping;
  readonly filter: InboxFilter;
  /** The current time, read whenever an age is measured. */
  readonly now: () => Date;
  /** The instant the list is built at, so ages move with the clock. */
  readonly at: Date;
}

/** A failure of GitHub or the cache, which the status line names. */
type Failure = ProviderError | CacheError;

/** The inbox's list, and how far the read behind it has come. */
export interface UseInboxResult {
  readonly list?: InboxList;
  readonly readAt?: Date;
  readonly failure?: Failure;
  readonly problem?: Problem;
  /** Whether a read is under way. */
  readonly reading: boolean;
  /** The pages of the read under way, once GitHub reports any. */
  readonly progress?: PageProgress;
  /** When the read under way began. */
  readonly startedAt?: Date;
}

/** Nothing changes, for a source with no cache, such as setup. */
const ignore = () => () => {};

/** Whether `error` is a failure GitHub or the cache names. */
const isFailure = (error: unknown): error is Failure => isNamedError(error);

/**
 * Reads the notification inbox through the cache while the mode is on
 * screen and the pane is awake, and builds its list at every instant the
 * screen is drawn at. What the cache holds shows at once, however old,
 * while the read that follows brings it up to date in place; with
 * nothing held, the loading line stays until the read settles. A failure
 * leaves the cached rows on screen and goes with the list for the status
 * line to name; only when nothing is held does the failure stand in for
 * the list.
 */
export default function useInbox({
  source,
  shown,
  attention,
  syncedAt,
  watched,
  grouping,
  filter,
  now,
  at,
}: UseInboxProps): UseInboxResult {
  const cache = "cache" in source ? source.cache : undefined;
  const cached = useSyncExternalStore(
    cache?.subscribe ?? ignore,
    cache?.notifications ?? (() => undefined as never),
  );
  const [failure, setFailure] = useState<Failure>();
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<PageProgress>();
  const [startedAt, setStartedAt] = useState<Date>();
  const awake = attention !== "idle";
  const reader = shown && awake && "cache" in source ? source : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a sync triggers a read.
  useEffect(() => {
    if (!reader) return;
    let current = true;
    setReading(true);
    setProgress(undefined);
    setStartedAt(now());
    reader
      .readInbox((next) => {
        if (current) setProgress(next);
      })
      .then(
        () => {
          if (!current) return;
          setFailure(undefined);
          setReading(false);
          setProgress(undefined);
          setStartedAt(undefined);
        },
        (error) => {
          if (!current) return;
          setFailure(isFailure(error) ? error : undefined);
          setReading(false);
          setProgress(undefined);
          setStartedAt(undefined);
          if (!isFailure(error)) throw error;
        },
      );
    return () => {
      current = false;
    };
  }, [reader, syncedAt]);
  const list = cached
    ? listInbox(cached.items, watched, { mode: "inbox", grouping, filter }, at)
    : undefined;
  return {
    ...(list && { list, ...(cached && { readAt: cached.syncedAt }) }),
    ...(failure &&
      (list ? { failure } : { problem: describeFailure(failure) })),
    reading,
    ...(progress && { progress }),
    ...(startedAt && { startedAt }),
  };
}
