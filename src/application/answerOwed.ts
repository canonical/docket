import { owedGroupings } from "../lib/owed/index.js";
import { renderOwed } from "../lib/text/index.js";
import buildOwed from "./buildOwed.js";
import fail from "./fail.js";
import readThreads from "./readThreads.js";
import readViewer from "./readViewer.js";
import type { Session } from "./types.js";

/**
 * Answers `docket owed`, and `docket` alone, from the cached threads,
 * marking the viewer as `you`.
 *
 * @note Impure: reads the cache, which asks GitHub when its data or the
 * login gh is signed in with is too old, and writes the answer.
 */
export default async function answerOwed(session: Session): Promise<number> {
  const { context, invocation, watched } = session;
  const grouping = owedGroupings.find((entry) => entry === invocation.by);
  if (!grouping) {
    fail(
      "USAGE_INVALID_VALUE",
      `\`--by\` takes ${owedGroupings.join(", ")}, not \`${invocation.by}\`.`,
      "run docket owed --help",
    );
  }
  const { threads, syncedAt, warnings } = await readThreads(session);
  const you = await readViewer(session);
  const list = buildOwed(threads, watched, grouping, context.now(), you.viewer);
  context.write(
    renderOwed({
      list,
      freshness: session.describeFreshness(syncedAt, [
        ...warnings,
        ...you.warnings,
      ]),
      format: invocation.format,
      detail: invocation.detail,
    }),
  );
  return 0;
}
