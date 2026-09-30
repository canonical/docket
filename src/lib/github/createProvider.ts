import type { Provider } from "../provider/index.js";
import { capabilities } from "./constants.js";
import createClient from "./createClient.js";
import fetchAssignees from "./fetchAssignees.js";
import fetchEvents from "./fetchEvents.js";
import fetchFile from "./fetchFile.js";
import fetchSnapshot from "./fetchSnapshot.js";
import fetchThreadDetail from "./fetchThreadDetail.js";
import fetchThreadDetails from "./fetchThreadDetails.js";
import fetchViewer from "./fetchViewer.js";
import listAssignableUsers from "./listAssignableUsers.js";
import listReviewCandidates from "./listReviewCandidates.js";
import listTeamMembers from "./listTeamMembers.js";
import probeChanges from "./probeChanges.js";
import readToken from "./readToken.js";
import refreshChecks from "./refreshChecks.js";
import setAssignees from "./setAssignees.js";
import setReviewers from "./setReviewers.js";

/**
 * Connects to GitHub as the account `gh` is signed in with. The token is
 * read once, here, and stays inside the provider: no operation returns
 * it, and no error carries it.
 *
 * @note Impure: runs `gh`, and every operation reads from or writes to
 * GitHub.
 * @param host The GitHub host of the watched repositories, as the
 * configuration's `hosts` names it, such as `github.com`.
 * @param version docket's version, sent in the User-Agent GitHub requires.
 * @throws GitHubError `GH_NOT_INSTALLED`, `GH_NOT_SIGNED_IN` or
 * `GH_TIMED_OUT` when `gh` gives no token.
 */
export default async function createProvider(
  host: string,
  version: string,
): Promise<Provider> {
  const client = createClient(await readToken(host), host, version);
  // Every incremental snapshot sees the newest thread again, so a team
  // requested on it would be read every cycle. Teams change rarely, so
  // each team's members are read once and kept while the provider lives.
  const teams = new Map<string, readonly string[]>();
  const teamMembers = async (team: string) => {
    const known = teams.get(team);
    if (known) return known;
    const members = await listTeamMembers(client, team);
    teams.set(team, members);
    return members;
  };
  return {
    snapshot: (repo, cursor, onPage) =>
      fetchSnapshot(client, repo, cursor, teamMembers, onPage),
    refreshVolatile: (threads) => refreshChecks(client, threads),
    events: (repo, since) => fetchEvents(client, repo, since),
    threadDetail: (thread) => fetchThreadDetail(client, thread),
    threadDetails: (threads) => fetchThreadDetails(client, threads),
    assignableUsers: (repo) => listAssignableUsers(client, repo),
    reviewCandidates: (pull) => listReviewCandidates(client, pull),
    readAssignees: (thread) => fetchAssignees(client, thread),
    setAssignees: (thread, logins) => setAssignees(client, thread, logins),
    setReviewers: (pull, reviewers) => setReviewers(client, pull, reviewers),
    teamMembers: ({ team }) => teamMembers(team),
    probe: (repo, tag) => probeChanges(client, repo, tag),
    readFile: (repo, path) => fetchFile(client, repo, path),
    readBudgets: () => client.readBudgets(),
    viewer: () => fetchViewer(client),
    capabilities: () => capabilities,
  };
}
