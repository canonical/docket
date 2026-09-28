import type { Account } from "../lib/people/index.js";
import writeSet, {
  type WriteOutcome,
  type WriteRequest,
  type WriteTarget,
} from "./writeSet.js";

/** Logins as the accounts a thread's assignees hold. */
const listAccounts = (logins: readonly string[]): Account[] =>
  logins.map((login) => ({ login, type: "user" }));

/**
 * Writes the set an editor applies, as `docket assign --confirm` and
 * `docket review --confirm` do, saying to apply again when it fails. An
 * assignment shows on its row at once, before GitHub answers: the cache
 * patches the thread in memory, and once GitHub has answered the row
 * shows the set GitHub records, the refreshed thread or, when the refresh
 * failed or nothing was sent, the set GitHub answered. A refusal takes
 * the patch back. A review request is shown only once GitHub answers.
 *
 * @note Impure: patches the cache's threads, and writes to GitHub.
 * @throws ProviderError when GitHub refuses the change or a read.
 */
export default async function writeFromTerminal(
  { provider, cache }: WriteTarget,
  request: Pick<WriteRequest, "action" | "thread" | "reference" | "wanted">,
): Promise<WriteOutcome> {
  const { action, thread, wanted } = request;
  const undo =
    action === "assign"
      ? cache.patchAssignees(thread, listAccounts(wanted))
      : undefined;
  let outcome: WriteOutcome;
  try {
    outcome = await writeSet(
      { provider, cache },
      { ...request, apply: true, format: "plain", retry: "apply again" },
    );
  } catch (error) {
    undo?.();
    throw error;
  }
  if (!undo) return outcome;
  undo();
  // A refreshed thread is GitHub's own copy, which the cache already gives.
  const { current, applied, warning } = outcome;
  if (!applied || warning) {
    cache.patchAssignees(thread, listAccounts(applied ?? current));
  }
  return outcome;
}
