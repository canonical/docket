import type { PersonalFile, Resolved } from "../lib/config/index.js";
import {
  type ConfigAnswer,
  chooseExitCode,
  type Problem,
  renderConfig,
} from "../lib/text/index.js";
import isNamedError from "./isNamedError.js";
import readRepositoryFiles from "./readRepositoryFiles.js";
import type { Connection, Context, Invocation, Watched } from "./types.js";

/**
 * Answers `docket config`: the settings in effect for each watched
 * repository, with its own file read through the cache under the
 * default maximum age, as the other commands read it, where each came from,
 * and the account gh is signed in with. When gh gives no token, or GitHub
 * does not answer, it says why and exits with that problem's code: 2 for
 * gh, 3 for GitHub. The repositories' files are read before the account,
 * so a repository shows its own file's settings even when GitHub then
 * fails to give the account; it shows the settings the personal file and
 * the built-in defaults give only when its file could not be read.
 *
 * @param connection The provider gh's token opened, with the cache on
 * it, or why gh gave no token.
 *
 * @note Impure: reads the cache, which asks GitHub for a repository's
 * file it holds too old, asks GitHub which account gh is signed in with,
 * and writes the answer.
 */
export default async function answerConfig(
  context: Context,
  invocation: Invocation,
  personal: PersonalFile,
  resolved: Resolved,
  connection: Connection | Problem,
): Promise<number> {
  const { repos } = resolved.settings;
  const layer = personal.outcome?.ok ? personal.outcome.layer : undefined;
  let watched: readonly Watched[] = repos.map((repo) => ({
    ...repo,
    resolved,
  }));
  let warnings: readonly Problem[] = [];
  let gh: ConfigAnswer["gh"];
  if ("code" in connection) {
    gh = connection;
  } else {
    try {
      ({ watched, warnings } = await readRepositoryFiles(
        connection.cache,
        invocation.maxAge,
        layer,
        repos,
      ));
      gh = { login: await connection.provider.viewer() };
    } catch (error) {
      if (!isNamedError(error)) throw error;
      const { code, message, recovery } = error;
      gh = { code, message, recovery };
    }
  }
  context.write(
    renderConfig({
      personal: { path: personal.path, found: personal.outcome !== undefined },
      repositories: watched.map((repo) => ({ repo, resolved: repo.resolved })),
      shared: resolved,
      gh,
      warnings,
      format: invocation.format,
    }),
  );
  return "code" in gh ? chooseExitCode(gh.code) : 0;
}
