import { renderActivity } from "../lib/text/index.js";
import buildActivity from "./buildActivity.js";
import chooseActivityAddress from "./chooseActivityAddress.js";
import readEvents, { type ReadEvents } from "./readEvents.js";
import readThreads from "./readThreads.js";
import readWindowEvents from "./readWindowEvents.js";
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
  const { context, invocation, resolved, watched } = session;
  const { settings } = resolved;
  const { window, grouping } = chooseActivityAddress(
    settings.activity,
    invocation,
  );
  const read = await readThreads(session);
  const reads: ReadEvents[] = [];
  const now = context.now();
  const events = await readWindowEvents(
    async (repo, since) => {
      const held = await readEvents(session, repo, since);
      reads.push(held);
      return held.events;
    },
    watched,
    window,
    now,
  );
  const list = buildActivity(
    events,
    read.threads,
    watched,
    window,
    grouping,
    now,
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
