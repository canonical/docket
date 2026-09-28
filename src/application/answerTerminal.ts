import {
  type Layer,
  resolveSettings,
  type Settings,
} from "../lib/config/index.js";
import type { OwedGrouping } from "../lib/owed/index.js";
import type { Problem } from "../lib/text/index.js";
import describeFailure from "./describeFailure.js";
import openInBrowser from "./openInBrowser.js";
import readCandidates from "./readCandidates.js";
import readRepositoryFiles from "./readRepositoryFiles.js";
import type {
  Connection,
  Context,
  TerminalMode,
  TerminalView,
  WatchedFiles,
} from "./types.js";
import writeSet from "./writeSet.js";

/**
 * Opens the terminal interface on `mode` at once, with owed grouped by
 * `owedGrouping`: on the shared cache of every watched repository, each
 * on the built-in defaults and the personal file, with a reading of each
 * repository's own file that the interface starts once it has opened,
 * and a reading of activity's events. When gh gives no token, it opens
 * on the reason and its recovery
 * instead.
 *
 * @note Impure: takes over the terminal until it is closed, and the
 * readings it hands the interface read through the cache, which asks
 * GitHub when a file or the events it holds are older than `maxAge`.
 * @param maxAge How old a cached repository file or cached events may be,
 * in milliseconds.
 * @param connection The provider gh's token opens with the cache on it, or
 * why gh gave no token.
 * @param activity The window and grouping activity opens on, when the
 * call names them.
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
  activity?: TerminalView["activity"],
): Promise<number> {
  const { now, openTerminal } = context;
  if ("code" in connection) {
    const source = { problem: connection };
    return openTerminal({
      mode,
      owedGrouping,
      activity,
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
    activity,
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
      readCandidates: (action, thread) =>
        readCandidates(provider, action, thread),
      // The editors write as text mode's confirmed writes do, and say in
      // their own words how to retry.
      write: (request) =>
        writeSet(
          { provider, cache },
          { ...request, apply: true, format: "plain", retry: "apply again" },
        ),
      readEvents: (repo, since) => cache.readEvents(repo, since, maxAge),
    },
  });
}
