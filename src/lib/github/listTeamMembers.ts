import collectPages from "./collectPages.js";
import type { Client, PageNode } from "./types.js";

const document = `query TeamMembers($organisation: String!, $team: String!, $after: String) {
  rateLimit { limit remaining resetAt }
  organization(login: $organisation) {
    team(slug: $team) {
      members(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { login }
      }
    }
  }
}`;

interface Answer {
  readonly organization: {
    readonly team: {
      readonly members: PageNode<{ readonly login: string }>;
    } | null;
  } | null;
}

/**
 * Lists the logins of a team, written `organisation/team`. A team GitHub
 * does not show the reader lists nobody.
 */
export default async function listTeamMembers(
  client: Client,
  team: string,
): Promise<string[]> {
  const [organisation, slug] = team.split("/");
  const members = await collectPages(async (after) => {
    const answer = await client.query<Answer>(document, {
      organisation,
      team: slug,
      after,
    });
    return answer.organization?.team?.members;
  });
  return members.map(({ login }) => login);
}
