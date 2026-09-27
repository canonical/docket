import type { Reviewer } from "../provider/index.js";
import type { ThreadSummary } from "../waits/index.js";
import readAccount from "./readAccount.js";
import splitRepo from "./splitRepo.js";
import type { Client, RestAccount } from "./types.js";

/** The reviews requested on a pull request, as REST gives them. */
interface Requested {
  readonly users: readonly RestAccount[];
  readonly teams: readonly { readonly slug: string }[];
}

/** A pull request as REST gives it after a change to its requests. */
interface PullAnswer {
  readonly requested_reviewers: readonly RestAccount[];
  readonly requested_teams: readonly { readonly slug: string }[];
}

const missing = (from: readonly string[], among: readonly string[]) => {
  const kept = new Set(among.map((entry) => entry.toLowerCase()));
  return from.filter((entry) => !kept.has(entry.toLowerCase()));
};

/**
 * Makes `reviewers` the whole set of reviews requested on a pull request:
 * logins, and teams written `organisation/team`. GitHub's own calls only
 * add or only remove, so this reads the requests standing and sends the
 * difference, removals first. Names match whatever their case.
 *
 * @note Impure: writes to GitHub.
 * @returns The requests GitHub records afterwards. A reviewer who has
 * already reviewed is no longer listed by GitHub as requested.
 */
export default async function setReviewers(
  client: Client,
  pullRequest: ThreadSummary,
  reviewers: readonly string[],
): Promise<Reviewer[]> {
  const { owner, name } = splitRepo(pullRequest.repo);
  const route = "/repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers";
  const target = { owner, repo: name, pull_number: pullRequest.number };
  const read = await client.request<Requested>(`GET ${route}`, target);
  let users = read.data.users;
  let teams = read.data.teams;
  // Teams are named by their slug alone within the repository's owner.
  const wantedUsers = reviewers.filter((entry) => !entry.includes("/"));
  const wantedTeams = reviewers
    .filter((entry) => entry.includes("/"))
    .map((entry) => entry.slice(entry.indexOf("/") + 1));
  const currentUsers = users.map(({ login }) => login);
  const currentTeams = teams.map(({ slug }) => slug);
  const changes = [
    [
      "DELETE",
      missing(currentUsers, wantedUsers),
      missing(currentTeams, wantedTeams),
    ],
    [
      "POST",
      missing(wantedUsers, currentUsers),
      missing(wantedTeams, currentTeams),
    ],
  ] as const;
  for (const [method, logins, slugs] of changes) {
    if (logins.length === 0 && slugs.length === 0) continue;
    const answer = await client.request<PullAnswer>(`${method} ${route}`, {
      ...target,
      reviewers: logins,
      team_reviewers: slugs,
    });
    users = answer.data.requested_reviewers;
    teams = answer.data.requested_teams;
  }
  return [
    ...users.map(readAccount),
    ...teams.map(({ slug }) => ({ team: `${owner}/${slug}` })),
  ];
}
