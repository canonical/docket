import type { PageProgress, Provider } from "../provider/index.js";
import { reconcileInterval } from "./constants.js";
import mergeSnapshot from "./mergeSnapshot.js";
import type { RepoCache } from "./types.js";

/** How one repository is synced. */
export interface SyncOptions {
  /**
   * Whether the sync may spend the rate budget. Without it, only the free
   * check for changes runs: a repository it sees unchanged is current as
   * it is, and one it sees changed, or one with nothing cached, is left
   * for a sync that may spend.
   */
  readonly spend?: boolean;
  /**
   * Whether the whole fetch runs when the last is `reconcileInterval` old.
   * Without it, the repository is fetched whole only when nothing is
   * cached, and otherwise since its cursor.
   */
  readonly reconcile?: boolean;
  /** Hears of each page of a whole fetch. */
  readonly onPage?: (progress: PageProgress) => void;
}

/**
 * Brings one repository's cache up to date at `at`, or gives `undefined`
 * when that needs points it may not spend.
 *
 * The provider's free check for changes runs first, when it has one. The
 * repository is then fetched whole when nothing is cached or the last
 * whole fetch is `reconcileInterval` old; otherwise the threads changed
 * since the cursor are fetched, and only when the check saw a change. The
 * check sees neither discussions nor finished checks: the hourly whole
 * fetch catches the one and the checks refresh the other. A repository
 * the check sees changed while nothing may be spent keeps the tag it had,
 * so the next check sees the change again.
 *
 * @note Impure: reads from the provider.
 */
export default async function syncRepo(
  provider: Provider,
  repo: string,
  previous: RepoCache | undefined,
  at: Date,
  { spend = true, reconcile = true, onPage }: SyncOptions = {},
): Promise<RepoCache | undefined> {
  const check = async (held: string | undefined) =>
    provider.capabilities().has("changeProbe")
      ? provider.probe(repo, held)
      : { changed: true, tag: undefined };
  if (!spend) {
    if (!previous) return undefined;
    const { changed, tag } = await check(previous.tag);
    return changed ? undefined : { ...previous, tag };
  }
  const { changed, tag } = await check(previous?.tag);
  if (
    !previous ||
    (reconcile &&
      at.getTime() - previous.reconciledAt.getTime() >= reconcileInterval)
  ) {
    const { threads, cursor } = await provider.snapshot(repo, null, onPage);
    return {
      threads: threads.filter(({ open }) => open),
      cursor,
      tag,
      reconciledAt: at,
    };
  }
  if (!changed) return { ...previous, tag };
  const { threads, cursor } = await provider.snapshot(repo, previous.cursor);
  return {
    threads: mergeSnapshot(previous.threads, threads),
    cursor,
    tag,
    reconciledAt: previous.reconciledAt,
  };
}
