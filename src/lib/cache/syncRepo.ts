import type { PageProgress, Provider } from "../provider/index.js";
import { reconcileInterval } from "./constants.js";
import mergeSnapshot from "./mergeSnapshot.js";
import type { RepoCache } from "./types.js";

/**
 * Brings one repository's cache up to date at `at`.
 *
 * The provider's free check for changes runs first, when it has one. The
 * repository is then fetched whole when nothing is cached or the last
 * whole fetch is `reconcileInterval` old; otherwise the threads changed
 * since the cursor are fetched, and only when the check saw a change. The
 * check sees neither discussions nor finished checks: the hourly whole
 * fetch catches the one and the checks refresh the other.
 *
 * @note Impure: reads from the provider.
 * @param onPage Hears of each page of a whole fetch.
 */
export default async function syncRepo(
  provider: Provider,
  repo: string,
  previous: RepoCache | undefined,
  at: Date,
  onPage?: (progress: PageProgress) => void,
): Promise<RepoCache> {
  const { changed, tag } = provider.capabilities().has("changeProbe")
    ? await provider.probe(repo, previous?.tag)
    : { changed: true, tag: undefined };
  if (
    !previous ||
    at.getTime() - previous.reconciledAt.getTime() >= reconcileInterval
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
