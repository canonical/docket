import {
  type Layer,
  resolveSettings,
  type Settings,
} from "../lib/config/index.js";
import type { OwedGrouping } from "../lib/owed/index.js";
import type { Problem } from "../lib/text/index.js";
import describeFailure from "./describeFailure.js";
import openInBrowser from "./openInBrowser.js";
import readRepositoryFiles from "./readRepositoryFiles.js";
import type {
  Connection,
  Context,
  TerminalMode,
  WatchedFiles,
} from "./types.js";

/**
 * Opens the terminal interface on `mode` at once, with owed grouped by
 * `owedGrouping`: on the shared cache of every watched repository, each
 * on the built-in defaults and the personal file, with a reading of each
 * repository's own file that the interface starts once it has opened.
 * When gh gives no token, it opens on the reason and its recovery
 * instead.
 *
 * @note Impure: takes over the terminal until it is closed, and the
 * reading it hands the interface reads through the cache, which asks
 * GitHub when a file it holds is older than `maxAge`.
 * @param maxAge How old a cached repository file may be, in milliseconds.
 * @param connection The provider gh's token opens with the cache on it, or
 * why gh gave no token.
 * @returns The exit code the interface closes with.
 */
export default async function answerTerminal(
  context: Context,
  mode: TerminalMode,
  owedGrouping: OwedGrouping,
  maxAge: number,
  personal: Layer | undefined,
  settings: Settings,
  connection: Connection | Problem,
): Promise<number> {
  const { now, openTerminal } = context;
  if ("code" in connection) {
    const source = { problem: connection };
    return openTerminal({
      mode,
      owedGrouping,
      now,
      openInBrowser,
      settings,
      watched: [],
      source,
    });
  }
  const { provider, cache } = connection;
  const readWatched = async (): Promise<WatchedFiles> => {
    try {
      const { watched } = await readRepositoryFiles(
        cache,
        maxAge,
        personal,
        settings.repos,
      );
      return { watched };
    } catch (error) {
      // The interface is already open, so a failure is shown in it, as a
      // named problem, rather than thrown where nothing can catch it.
      return { problem: describeFailure(error) };
    }
  };
  return openTerminal({
    mode,
    owedGrouping,
    now,
    openInBrowser,
    settings,
    watched: settings.repos.map((repo) => ({
      ...repo,
      resolved: resolveSettings(personal, undefined),
    })),
    source: {
      cache,
      capabilities: provider.capabilities(),
      readWatched,
      readDetail: (thread) => provider.threadDetail(thread),
    },
  });
}
