import fragments from "./fragments.js";
import type { Client, PageNode } from "./types.js";

const document = `query TeamMembers($organisation: String!, $team: String!, $cursor: String) {
  ${fragments.rateLimit}
  organization(login: $organisation) {
    team(slug: $team) {
      members(first: 100, after: $cursor) {
        ${fragments.pageInfo}
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
  const answer = await client.paginate<Answer>(document, {
    organisation,
    team: slug,
  });
  return (answer.organization?.team?.members.nodes ?? []).map(
    ({ login }) => login,
  );
}
