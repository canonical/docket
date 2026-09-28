import { owedGroupings } from "../lib/owed/index.js";
import { renderOwed } from "../lib/text/index.js";
import buildOwed from "./buildOwed.js";
import fail from "./fail.js";
import readThreads from "./readThreads.js";
import type { Session } from "./types.js";

/**
 * Answers `docket owed`, and `docket` alone, from the cached threads.
 *
 * @note Impure: reads the cache, which asks GitHub when its data is
 * too old, and writes the answer.
 */
export default async function answerOwed(session: Session): Promise<number> {
  const { context, invocation, resolved } = session;
  const grouping = owedGroupings.find((entry) => entry === invocation.by);
  if (!grouping) {
    fail(
      "USAGE_INVALID_VALUE",
      `\`--by\` takes ${owedGroupings.join(", ")}, not \`${invocation.by}\`.`,
      "run docket owed --help",
    );
  }
  const { threads, syncedAt, warnings } = await readThreads(session);
  const list = buildOwed(threads, resolved.settings, grouping, context.now());
  context.write(
    renderOwed({
      list,
      freshness: session.describeFreshness(syncedAt, warnings),
      format: invocation.format,
      detail: invocation.detail,
    }),
  );
  return 0;
}
