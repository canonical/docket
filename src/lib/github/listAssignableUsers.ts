import type { Account } from "../people/index.js";
import fragments from "./fragments.js";
import splitRepo from "./splitRepo.js";
import type { Client, PageNode } from "./types.js";

const document = `query Assignable($owner: String!, $name: String!, $cursor: String) {
  ${fragments.rateLimit}
  repository(owner: $owner, name: $name) {
    assignableUsers(first: 100, after: $cursor) {
      ${fragments.pageInfo}
      nodes { login }
    }
  }
}`;

interface Answer {
  readonly repository: {
    readonly assignableUsers: PageNode<{ readonly login: string }>;
  };
}

/**
 * Lists everyone GitHub lets be assigned in `repo`. GitHub lists people
 * only here, so each is a person's account.
 *
 * @note Impure: reads from GitHub.
 */
export default async function listAssignableUsers(
  client: Client,
  repo: string,
): Promise<Account[]> {
  const { owner, name } = splitRepo(repo);
  const answer = await client.paginate<Answer>(document, { owner, name });
  return answer.repository.assignableUsers.nodes.map(({ login }) => ({
    login,
    type: "user",
  }));
}
