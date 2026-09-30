import { finishedGroupings } from "../lib/finished/index.js";
import { renderFinished } from "../lib/text/index.js";
import buildFinished from "./buildFinished.js";
import chooseWindow from "./chooseWindow.js";
import fail from "./fail.js";
import readEvents, { type ReadEvents } from "./readEvents.js";
import readThreads from "./readThreads.js";
import readViewer from "./readViewer.js";
import readWindowEndings from "./readWindowEndings.js";
import type { Session } from "./types.js";

/**
 * Answers `docket finished`: the threads merged or closed within one of
 * the configured windows, the first when `--window` is not given, read
 * through the cache under the call's maximum age with activity's events,
 * and marking the viewer as `you`.
 *
 * @note Impure: reads the cache, which asks GitHub when its threads,
 * events or the login gh is signed in with are too old, and writes the
 * answer.
 */
export default async function answerFinished(
  session: Session,
): Promise<number> {
  const { context, invocation, resolved, watched } = session;
  const window = chooseWindow(
    resolved.settings.activity,
    invocation.window,
    "finished",
  );
  const grouping = finishedGroupings.find((entry) => entry === invocation.by);
  if (!grouping) {
    fail(
      "USAGE_INVALID_VALUE",
      `\`--by\` takes ${finishedGroupings.join(", ")}, not \`${invocation.by}\`.`,
      "run docket finished --help",
    );
  }
  const read = await readThreads(session);
  const reads: ReadEvents[] = [];
  const now = context.now();
  const endings = await readWindowEndings(
    async (repo, since) => {
      const held = await readEvents(session, repo, since);
      reads.push(held);
      return held.finished;
    },
    watched,
    window,
    now,
  );
  const you = await readViewer(session);
  const list = buildFinished(
    endings,
    read.threads,
    watched,
    window,
    grouping,
    now,
    you.viewer,
  );
  // The data is as old as the oldest of the threads and the endings, and
  // a failure met on several repositories is told once.
  const synced = [read.syncedAt, ...reads.map((each) => each.syncedAt)];
  const syncedAt = synced.every((at) => at !== undefined)
    ? new Date(Math.min(...synced.map(Number)))
    : undefined;
  const warnings = [
    ...read.warnings,
    ...reads.flatMap((each) => each.warnings),
    ...you.warnings,
  ].filter(
    (warning, index, all) =>
      all.findIndex(({ code }) => code === warning.code) === index,
  );
  context.write(
    renderFinished({
      list,
      freshness: session.describeFreshness(syncedAt, warnings),
      format: invocation.format,
      detail: invocation.detail,
    }),
  );
  return 0;
}
