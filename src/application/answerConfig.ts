import type { PersonalFile, Resolved } from "../lib/config/index.js";
import { type Problem, renderConfig } from "../lib/text/index.js";
import type { Context, Invocation } from "./types.js";

/**
 * Answers `docket config`: the settings in effect for each watched
 * repository, where each came from, and whether gh gives a token. It
 * exits 2 when gh does not, after saying why.
 *
 * @param gh Why gh gave no token, or `undefined` when it gave one.
 */
export default function answerConfig(
  context: Context,
  invocation: Invocation,
  personal: PersonalFile,
  resolved: Resolved,
  gh: Problem | undefined,
): number {
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
  return gh ? 2 : 0;
}
