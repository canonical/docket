import type { Budget, Provider } from "../provider/index.js";
import { capabilities } from "./constants.js";
import createClient from "./createClient.js";
import fetchEvents from "./fetchEvents.js";
import fetchSnapshot from "./fetchSnapshot.js";
import fetchThreadDetail from "./fetchThreadDetail.js";
import listAssignableUsers from "./listAssignableUsers.js";
import listReviewCandidates from "./listReviewCandidates.js";
import listTeamMembers from "./listTeamMembers.js";
import probeChanges from "./probeChanges.js";
import readToken from "./readToken.js";
import refreshChecks from "./refreshChecks.js";
import setAssignees from "./setAssignees.js";
import setReviewers from "./setReviewers.js";

const budgetDocument = `query Budget { rateLimit { limit remaining resetAt } }`;

interface BudgetAnswer {
  readonly rateLimit: {
    readonly limit: number;
    readonly remaining: number;
    readonly resetAt: string;
  };
}

/**
 * Connects to GitHub as the account `gh` is signed in with. The token is
 * read once, here, and stays inside the provider: no operation returns
 * it, and no error carries it.
 *
 * @note Impure: runs `gh`, and every operation reads from or writes to
 * GitHub.
 * @param version docket's version, sent in the User-Agent GitHub requires.
 * @throws GitHubError `GH_NOT_INSTALLED` or `GH_NOT_SIGNED_IN` when `gh`
 * gives no token.
 */
export default async function createProvider(
  version: string,
): Promise<Provider> {
  const client = createClient(await readToken(), version);
  return {
    snapshot: (repo, cursor) => fetchSnapshot(client, repo, cursor),
    refreshVolatile: (threads) => refreshChecks(client, threads),
    events: (repo, since) => fetchEvents(client, repo, since),
    threadDetail: (thread) => fetchThreadDetail(client, thread),
    assignableUsers: (repo) => listAssignableUsers(client, repo),
    reviewCandidates: (pull) => listReviewCandidates(client, pull),
    setAssignees: (thread, logins) => setAssignees(client, thread, logins),
    setReviewers: (pull, reviewers) => setReviewers(client, pull, reviewers),
    teamMembers: (team) => listTeamMembers(client, team),
    probe: (repo, tag) => probeChanges(client, repo, tag),
    async budget(): Promise<Budget> {
      // Asking for the rate figures alone is not charged, so the first
      // call costs nothing; later ones reuse the latest answer's figures.
      const known = client.lastBudget();
      if (known) return known;
      const { rateLimit } = await client.query<BudgetAnswer>(
        budgetDocument,
        {},
      );
      const { limit, remaining, resetAt } = rateLimit;
      return { limit, remaining, resetAt: new Date(resetAt) };
    },
    capabilities: () => capabilities,
  };
}
