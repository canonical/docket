import type { Provider } from "../lib/provider/index.js";
import type { Thread } from "../lib/waits/index.js";
import isAssignable from "./isAssignable.js";
import nameReviewer from "./nameReviewer.js";
import type { Candidates } from "./types.js";
import type { WriteAction } from "./writeSet.js";

/**
 * Reads from GitHub whom an editor offers for `thread`, and the set it
 * holds: for assigning, the assignees and everyone the repository
 * can assign; for a review, the requests and whom GitHub suggests, then
 * the collaborators and the teams.
 *
 * @note Impure: reads GitHub.
 * @throws ProviderError when GitHub fails.
 */
export default async function readCandidates(
  provider: Provider,
  action: WriteAction,
  thread: Thread,
): Promise<Candidates> {
  if (action === "assign" && isAssignable(thread)) {
    const [current, offered] = await Promise.all([
      provider.readAssignees(thread),
      provider.assignableUsers(thread.repo),
    ]);
    return {
      current: current.map(({ login }) => login),
      offered: offered.map(({ login }) => login),
    };
  }
  const { requested, suggested, people, teams } =
    await provider.reviewCandidates(thread);
  return {
    current: requested.map(nameReviewer),
    offered: [...suggested, ...people, ...teams].map(nameReviewer),
  };
}
