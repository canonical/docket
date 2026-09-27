import { activityGroupings } from "../lib/activity/index.js";
import { renderActivity } from "../lib/text/index.js";
import buildActivity from "./buildActivity.js";
import fail from "./fail.js";
import readThreads from "./readThreads.js";
import type { Session } from "./types.js";

/**
 * Answers `docket activity`: the events inside one of the configured
 * windows, the first when `--window` is not given.
 *
 * @note Impure: reads the cache, asks GitHub for the events, and
 * writes the answer.
 */
export default async function answerActivity(
  session: Session,
): Promise<number> {
  const { context, invocation, resolved, provider } = session;
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
  const { threads, syncedAt, warnings } = await readThreads(session);
  // The catalogue lets `--by` take only activity's groupings.
  const grouping =
    activityGroupings.find((entry) => entry === invocation.by) ?? "kind";
  const list = await buildActivity(
    provider,
    threads,
    settings,
    window,
    grouping,
    context.now(),
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
