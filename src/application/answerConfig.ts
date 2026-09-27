import type { PersonalFile, Resolved } from "../lib/config/index.js";
import type { Provider } from "../lib/provider/index.js";
import {
  type ConfigAnswer,
  chooseExitCode,
  type Problem,
  renderConfig,
} from "../lib/text/index.js";
import isNamedError from "./isNamedError.js";
import readRepositoryFiles from "./readRepositoryFiles.js";
import type { Context, Invocation, Watched } from "./types.js";

/**
 * Answers `docket config`: the settings in effect for each watched
 * repository, with its own file read from GitHub, where each came from,
 * and the account gh is signed in with. When gh gives no token, or GitHub
 * does not answer, it says why and exits with that problem's code: 2 for
 * gh, 3 for GitHub; each repository then shows the settings the personal
 * file and the built-in defaults give.
 *
 * @param connection The provider gh's token opened, or why gh gave none.
 *
 * @note Impure: asks GitHub which account gh is signed in with, and
 * writes the answer.
 */
export default async function answerConfig(
  context: Context,
  invocation: Invocation,
  personal: PersonalFile,
  resolved: Resolved,
  connection: Provider | Problem,
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
        connection,
        layer,
        repos,
      ));
      gh = { login: await connection.viewer() };
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
