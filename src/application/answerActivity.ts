import { activityGroupings } from "../lib/activity/index.js";
import { renderActivity } from "../lib/text/index.js";
import buildActivity from "./buildActivity.js";
import fail from "./fail.js";
import readEvents, { type ReadEvents } from "./readEvents.js";
import readThreads from "./readThreads.js";
import type { Session } from "./types.js";

/**
 * Answers `docket activity`: the events inside one of the configured
 * windows, the first when `--window` is not given, read through the
 * cache under the call's maximum age, as the threads are.
 *
 * @note Impure: reads the cache, which asks GitHub when its threads or
 * events are too old, and writes the answer.
 */
export default async function answerActivity(
  session: Session,
): Promise<number> {
  const { context, invocation, resolved } = session;
  const { settings } = resolved;
  const windows = settings.activity.map(
    (window) => [`${window.amount}${window.unit}`, window] as const,
  );
  const [first] = windows;
  const asked = invocation.window ?? first?.[0];
  const window = windows.find(([text]) => text === asked)?.[1];
  if (!window) {
    fail(
      "USAGE_INVALID_VALUE",
      `\`--window\` takes one of the configured windows, ${windows.map(([text]) => text).join(", ")}, not \`${asked}\`.`,
      "run docket activity --help",
    );
  }
  const grouping = activityGroupings.find((entry) => entry === invocation.by);
  if (!grouping) {
    fail(
      "USAGE_INVALID_VALUE",
      `\`--by\` takes ${activityGroupings.join(", ")}, not \`${invocation.by}\`.`,
      "run docket activity --help",
    );
  }
  const read = await readThreads(session);
  const reads: ReadEvents[] = [];
  const list = await buildActivity(
    async (repo, since) => {
      const events = await readEvents(session, repo, since);
      reads.push(events);
      return events.events;
    },
    read.threads,
    settings,
    window,
    grouping,
    context.now(),
  );
  // The data is as old as the oldest of the threads and the events, and
  // a failure met on several repositories is told once.
  const synced = [read.syncedAt, ...reads.map((each) => each.syncedAt)];
  const syncedAt = synced.every((at) => at !== undefined)
    ? new Date(Math.min(...synced.map(Number)))
    : undefined;
  const warnings = [
    ...read.warnings,
    ...reads.flatMap((each) => each.warnings),
  ].filter(
    (warning, index, all) =>
      all.findIndex(({ code }) => code === warning.code) === index,
  );
  context.write(
    renderActivity({
      list,
      freshness: session.describeFreshness(syncedAt, warnings),
      format: invocation.format,
      detail: invocation.detail,
    }),
  );
  return 0;
}
