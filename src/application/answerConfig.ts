import type { PersonalFile, Resolved } from "../lib/config/index.js";
import type { Provider } from "../lib/provider/index.js";
import {
  type ConfigAnswer,
  exitCode,
  type Problem,
  renderConfig,
} from "../lib/text/index.js";
import isNamedError from "./isNamedError.js";
import type { Context, Invocation } from "./types.js";

/**
 * Answers `docket config`: the settings in effect for each watched
 * repository, where each came from, and the account gh is signed in with.
 * When gh gives no token, or GitHub does not name the account, it says
 * why and exits with that problem's code: 2 for gh, 3 for GitHub.
 *
 * @param connection The provider gh's token opened, or why gh gave none.
 */
export default async function answerConfig(
  context: Context,
  invocation: Invocation,
  personal: PersonalFile,
  resolved: Resolved,
  connection: Provider | Problem,
): Promise<number> {
  let gh: ConfigAnswer["gh"];
  if ("code" in connection) {
    gh = connection;
  } else {
    try {
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
      // No repository's own file is read yet, so each repository has the
      // settings the personal file and the built-in defaults give.
      repositories: resolved.settings.repos.map((repo) => ({
        repo,
        resolved,
      })),
      shared: resolved,
      gh,
      format: invocation.format,
    }),
  );
  return "code" in gh ? exitCode(gh.code) : 0;
}
