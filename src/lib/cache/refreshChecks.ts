import type { CheckRefresh, Provider } from "../provider/index.js";
import type { RepoCache } from "./types.js";

/**
 * Reads again the checks still running on the pull requests `synced`
 * holds, every repository in one request, from a provider that has
 * checks: none when none are running. `onRead` hears the repositories
 * the request covers, before it is sent.
 *
 * @note Impure: reads from the provider.
 */
export default async function refreshChecks(
  provider: Pick<Provider, "capabilities" | "refreshVolatile">,
  synced: readonly RepoCache[],
  onRead?: (repos: readonly string[]) => void,
): Promise<readonly CheckRefresh[]> {
  if (!provider.capabilities().has("checks")) return [];
  const running = synced.flatMap(({ threads }) =>
    threads.filter(
      ({ kind, checks }) => kind === "pullRequest" && checks === "running",
    ),
  );
  if (running.length === 0) return [];
  onRead?.([...new Set(running.map(({ repo }) => repo))]);
  return provider.refreshVolatile(running);
}
