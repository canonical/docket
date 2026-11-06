import { listInbox } from "../lib/inbox/index.js";
import { renderInbox } from "../lib/text/index.js";
import chooseInboxAddress from "./chooseInboxAddress.js";
import type { Session } from "./types.js";

/**
 * Answers `docket inbox` from the cached notification inbox, grouping and
 * filtering it as the call names.
 *
 * @note Impure: reads the cache, which asks GitHub when its notifications
 * or the login gh is signed in with are too old, and writes the answer.
 */
export default async function answerInbox(session: Session): Promise<number> {
  const { context, invocation, resolved } = session;
  const address = chooseInboxAddress({
    by: invocation.byGiven ? invocation.by : undefined,
    all: invocation.all,
  });
  const cached = await session.cache.readNotifications(invocation.maxAge);
  const list = listInbox(
    cached.items,
    resolved.settings.repos,
    { mode: "inbox", ...address },
    context.now(),
  );
  context.write(
    renderInbox({
      list,
      freshness: session.describeFreshness(cached.syncedAt),
      format: invocation.format,
      detail: invocation.detail,
    }),
  );
  return 0;
}
