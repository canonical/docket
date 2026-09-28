import type { Account } from "../people/index.js";
import type { Assignable } from "../provider/index.js";
import readAccount from "./readAccount.js";
import splitRepo from "./splitRepo.js";
import type { Client, RestAccount } from "./types.js";

interface IssueAnswer {
  readonly assignees: readonly RestAccount[];
}

/**
 * Makes `logins` the whole set of assignees on an issue or pull request.
 * GitHub's own calls only add or only remove, so this reads the current
 * set and sends the difference: removals first, so the set never passes
 * GitHub's cap of ten on the way. Logins match whatever their case.
 *
 * @note Impure: writes to GitHub.
 * @returns The assignees GitHub records afterwards, which leave out any
 * login GitHub would not assign.
 */
export default async function setAssignees(
  client: Client,
  thread: Assignable,
  logins: readonly string[],
): Promise<Account[]> {
  const { owner, name } = splitRepo(thread.repo);
  const route = "/repos/{owner}/{repo}/issues/{issue_number}";
  const target = { owner, repo: name, issue_number: thread.number };
  const read = await client.request<IssueAnswer>(`GET ${route}`, target);
  let assignees = read.data.assignees;
  const has = (list: readonly string[], login: string) =>
    list.some((entry) => entry.toLowerCase() === login.toLowerCase());
  const current = assignees.map(({ login }) => login);
  const removed = current.filter((login) => !has(logins, login));
  const added = logins.filter((login) => !has(current, login));
  if (removed.length > 0) {
    const answer = await client.request<IssueAnswer>(
      `DELETE ${route}/assignees`,
      { ...target, assignees: removed },
    );
    assignees = answer.data.assignees;
  }
  if (added.length > 0) {
    const answer = await client.request<IssueAnswer>(
      `POST ${route}/assignees`,
      { ...target, assignees: added },
    );
    assignees = answer.data.assignees;
  }
  return assignees.map(readAccount);
}
