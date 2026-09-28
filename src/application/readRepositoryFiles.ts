import type { Cache } from "../lib/cache/index.js";
import {
  type Layer,
  parseFile,
  type Repo,
  resolveSettings,
} from "../lib/config/index.js";
import type { Problem } from "../lib/text/index.js";
import isNamedError from "./isNamedError.js";
import type { Watched } from "./types.js";

/** Where each repository keeps its own file, on its default branch. */
const repositoryFile = ".github/docket.yaml";

/** The watched repositories with their settings, and what kept a file unread. */
export interface RepositoryFiles {
  readonly watched: readonly Watched[];
  readonly warnings: readonly Problem[];
}

/**
 * Reads each watched repository's own file through the shared cache, no
 * older than `maxAge` milliseconds, as the threads are, and decides the
 * settings in effect for it, over the personal file and the built-in
 * defaults. A repository without a file takes the personal file's
 * settings; one whose file is invalid takes the built-in defaults for
 * every section that file may declare, and keeps the file's errors.
 *
 * A file GitHub fails to give, such as during a rate limit, leaves its
 * repository on the personal file's settings, with the failure as a
 * warning, so an answer from cached data can still be given.
 *
 * @note Impure: reads the cache, which asks GitHub when a file it holds
 * is too old.
 * @throws Error a `GH_*` failure, which no settings fix, and any failure
 * without a named code.
 */
export default async function readRepositoryFiles(
  cache: Cache,
  maxAge: number,
  personal: Layer | undefined,
  repos: readonly Repo[],
): Promise<RepositoryFiles> {
  const watched: Watched[] = [];
  const warnings: Problem[] = [];
  for (const repo of repos) {
    try {
      const { text } = await cache.readFile(repo.repo, repositoryFile, maxAge);
      const outcome =
        text === undefined ? undefined : parseFile(text, "repository");
      watched.push({ ...repo, resolved: resolveSettings(personal, outcome) });
    } catch (error) {
      if (!isNamedError(error) || error.code.startsWith("GH_")) throw error;
      warnings.push({
        code: error.code,
        message: `docket could not read ${repositoryFile} of ${repo.repo}, so the personal file's settings apply to it: ${error.message}`,
        recovery: error.recovery,
      });
      watched.push({ ...repo, resolved: resolveSettings(personal, undefined) });
    }
  }
  return { watched, warnings };
}
