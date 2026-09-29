import { useEffect, useState } from "react";
import type { CacheError } from "../lib/cache/index.js";
import type { ProviderError } from "../lib/provider/index.js";
import type { Problem } from "../lib/text/index.js";
import describeFailure from "./describeFailure.js";
import isNamedError from "./isNamedError.js";

/** Props for the useViewer hook. */
export interface UseViewerProps {
  /** Reads the login gh is signed in with; absent without GitHub. */
  readonly readViewer?: () => Promise<string>;
  /** When the cache last synced, which a failed read waits for. */
  readonly syncedAt?: Date;
}

/** A failure of GitHub or the cache, which the status line names. */
type Failure = ProviderError | CacheError;

/**
 * The login gh is signed in with once it is known. While it is not: the
 * failure GitHub or the network named, which the status line names, or a
 * defect, which stands in for the list.
 */
export interface UseViewerResult {
  readonly viewer?: string;
  readonly failure?: Failure;
  readonly problem?: Problem;
}

/** What the last read gave, and the sync it followed. */
interface Read {
  readonly result: UseViewerResult;
  readonly synced?: number;
}

const isFailure = (error: unknown): error is Failure => isNamedError(error);

/**
 * Reads the login gh is signed in with, once the screen has opened. A
 * failure such as no answer from the network leaves the viewer unknown,
 * so the lists show the cached rows and mark nobody as `you`, while the
 * status line names the failure. The read is tried again once the cache
 * syncs after the failure, since a sync is GitHub answering again, and
 * no sooner, so an offline screen sends no request of its own.
 *
 * @note Impure: reads GitHub.
 */
export default function useViewer({
  readViewer,
  syncedAt,
}: UseViewerProps): UseViewerResult {
  const [read, setRead] = useState<Read>();
  const synced = syncedAt?.getTime();
  const failed = read?.result.failure !== undefined;
  // Due on opening, then after each sync that follows a failure.
  const due =
    read === undefined
      ? "opening"
      : failed && synced !== read.synced
        ? synced
        : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a read is due on opening and after a sync that follows a failure; no other change starts one.
  useEffect(() => {
    if (!readViewer || due === undefined) return;
    let current = true;
    readViewer().then(
      (viewer) => current && setRead({ result: { viewer } }),
      (error: unknown) =>
        current &&
        setRead(
          isFailure(error)
            ? { result: { failure: error }, synced }
            : { result: { problem: describeFailure(error) } },
        ),
    );
    return () => {
      current = false;
    };
  }, [readViewer, due]);
  return read?.result ?? {};
}
