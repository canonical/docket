import type { Layer, Settings } from "../lib/config/index.js";
import type { Problem } from "../lib/text/index.js";
import isNamedError from "./isNamedError.js";
import readRepositoryFiles from "./readRepositoryFiles.js";
import type { Connection, Context, TerminalView, Watched } from "./types.js";

/**
 * Opens the terminal interface on owed: on the shared cache of every
 * watched repository, each on the settings its own file gives it, or, when
 * gh gives no token or GitHub refuses it, on the reason and its recovery.
 *
 * @note Impure: reads each repository's file through the cache, which asks
 * GitHub when the file it holds is older than `maxAge`, and takes over the
 * terminal until it is closed.
 * @param maxAge How old a cached repository file may be, in milliseconds.
 * @param connection The provider gh's token opens with the cache on it, or
 * why gh gave no token.
 * @returns The exit code the interface closes with.
 */
export default async function answerTerminal(
  context: Context,
  maxAge: number,
  personal: Layer | undefined,
  settings: Settings,
  connection: Connection | Problem,
): Promise<number> {
  const open = (watched: readonly Watched[], source: TerminalView["source"]) =>
    context.openTerminal({ now: context.now, settings, watched, source });
  if ("code" in connection) return open([], { problem: connection });
  const { provider, cache } = connection;
  let watched: readonly Watched[];
  try {
    ({ watched } = await readRepositoryFiles(
      cache,
      maxAge,
      personal,
      settings.repos,
    ));
  } catch (error) {
    if (!isNamedError(error)) throw error;
    const { code, message, recovery } = error;
    return open([], { problem: { code, message, recovery } });
  }
  return open(watched, { cache, capabilities: provider.capabilities() });
}
