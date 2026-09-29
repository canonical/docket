import type { CheckRefresh, Provider } from "../provider/index.js";
import type { RepoCache } from "./types.js";

/**
 * Reads again the checks still running on the pull requests `synced`
 * holds, every repository in one request, from a provider that has
 * checks: none when none are running.
 *
 * @note Impure: reads from the provider.
 */
export default async function refreshChecks(
  provider: Pick<Provider, "capabilities" | "refreshVolatile">,
  synced: readonly RepoCache[],
): Promise<readonly CheckRefresh[]> {
  if (!provider.capabilities().has("checks")) return [];
  const running = synced.flatMap(({ threads }) =>
    threads.filter(
      ({ kind, checks }) => kind === "pullRequest" && checks === "running",
    ),
  );
  return running.length === 0 ? [] : provider.refreshVolatile(running);
}
