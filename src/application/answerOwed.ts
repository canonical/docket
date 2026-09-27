import type { OwedGrouping } from "../lib/owed/index.js";
import { renderOwed } from "../lib/text/index.js";
import buildOwed from "./buildOwed.js";
import readThreads from "./readThreads.js";
import type { Session } from "./types.js";

/** Answers `docket owed`, and `docket` alone, from the cached threads. */
export default async function answerOwed(session: Session): Promise<number> {
  const { context, invocation, resolved } = session;
  const { threads, syncedAt, warnings } = await readThreads(session);
  const grouping = (invocation.by ?? "none") as OwedGrouping;
  const list = buildOwed(threads, resolved.settings, grouping, context.now());
  context.write(
    renderOwed({
      list,
      freshness: session.freshness(syncedAt, warnings),
      format: invocation.format,
      detail: invocation.detail,
    }),
  );
  return 0;
}
