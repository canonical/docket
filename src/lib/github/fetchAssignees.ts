import type { Account } from "../people/index.js";
import type { Assignable } from "../provider/index.js";
import readAccount from "./readAccount.js";
import splitRepo from "./splitRepo.js";
import type { Client, RestAccount } from "./types.js";

interface IssueAnswer {
  readonly assignees: readonly RestAccount[];
}

/**
 * Reads the assignees GitHub records on an issue or pull request at the
 * moment of asking, from the issue itself rather than a list, so no
 * cached or paged copy stands in for them.
 *
 * @note Impure: reads from GitHub.
 */
export default async function fetchAssignees(
  client: Client,
  thread: Assignable,
): Promise<Account[]> {
  const { owner, name } = splitRepo(thread.repo);
  const answer = await client.request<IssueAnswer>(
    "GET /repos/{owner}/{repo}/issues/{issue_number}",
    { owner, repo: name, issue_number: thread.number },
  );
  return answer.data.assignees.map(readAccount);
}
