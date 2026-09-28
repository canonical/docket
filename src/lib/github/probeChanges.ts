import type { ChangeProbe } from "../provider/index.js";
import splitRepo from "./splitRepo.js";
import type { Client } from "./types.js";

/**
 * Asks whether any issue or pull request in `repo` changed since the
 * answer that gave `tag`, by requesting the most recently updated one
 * with that entity tag. GitHub answers "not modified" (304) when nothing
 * changed, and that answer costs nothing against the rate limit. It sees
 * comments, labels, assignees, review requests, reviews and pushes, but
 * neither discussions nor finished checks.
 *
 * @note Impure: reads from GitHub.
 */
export default async function probeChanges(
  client: Client,
  repo: string,
  tag: string | undefined,
): Promise<ChangeProbe> {
  const { owner, name } = splitRepo(repo);
  const answer = await client.request("GET /repos/{owner}/{repo}/issues", {
    owner,
    repo: name,
    state: "all",
    sort: "updated",
    per_page: 1,
    headers: tag ? { "if-none-match": tag } : {},
  });
  if (answer.status === 304) return { changed: false, tag };
  const etag = answer.headers.etag;
  return { changed: true, tag: etag === undefined ? undefined : String(etag) };
}
