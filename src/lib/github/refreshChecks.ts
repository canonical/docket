import type { CheckRefresh } from "../provider/index.js";
import type { ThreadSummary } from "../waits/index.js";
import readChecks from "./readChecks.js";
import splitRepo from "./splitRepo.js";
import type { Client } from "./types.js";

interface Answer {
  readonly [repository: string]: {
    readonly [pullRequest: string]: {
      readonly commits: {
        readonly nodes: readonly {
          readonly commit: {
            readonly statusCheckRollup: { readonly state: string } | null;
          };
        }[];
      };
    } | null;
  } | null;
}

/**
 * Reads the checks of the given pull requests again, all in one query:
 * checks finish without marking a pull request as updated, so no other
 * query notices them. A pull request GitHub no longer finds is left out.
 *
 * @note Impure: reads from GitHub.
 */
export default async function refreshChecks(
  client: Client,
  pullRequests: readonly ThreadSummary[],
): Promise<CheckRefresh[]> {
  if (pullRequests.length === 0) return [];
  const repos = [...new Set(pullRequests.map(({ repo }) => repo))];
  // Aliases name each repository and pull request, so one query reads
  // them all. Names are written as JSON strings, which GraphQL reads as
  // its own string literals.
  const fields = repos.map((repo, index) => {
    const { owner, name } = splitRepo(repo);
    const pulls = pullRequests
      .filter((pull) => pull.repo === repo)
      .map(
        ({ number }) =>
          `p${number}: pullRequest(number: ${number}) { commits(last: 1) { nodes { commit { statusCheckRollup { state } } } } }`,
      );
    return `r${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { ${pulls.join(" ")} }`;
  });
  const answer = await client.query<Answer>(
    `query Checks { rateLimit { limit remaining resetAt } ${fields.join(" ")} }`,
    {},
    { allowMissing: true },
  );
  return pullRequests.flatMap(({ repo, number }) => {
    const pull = answer[`r${repos.indexOf(repo)}`]?.[`p${number}`];
    if (!pull) return [];
    const checks = readChecks(
      pull.commits.nodes.at(-1)?.commit.statusCheckRollup?.state,
    );
    return [{ repo, number, ...(checks ? { checks } : {}) }];
  });
}
