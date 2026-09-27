import type { Account } from "../people/index.js";
import splitRepo from "./splitRepo.js";
import type { Client, PageNode } from "./types.js";

const document = `query Assignable($owner: String!, $name: String!, $cursor: String) {
  rateLimit { limit remaining resetAt }
  repository(owner: $owner, name: $name) {
    assignableUsers(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
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
