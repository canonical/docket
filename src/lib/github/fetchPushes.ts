import splitRepo from "./splitRepo.js";
import type { Client, FeedPush, RestAccount } from "./types.js";

/** An entry of the repository activity feed. */
interface FeedEntry {
  readonly ref: string;
  readonly before: string;
  readonly after: string;
  readonly timestamp: string;
  readonly activity_type: string;
  readonly actor: RestAccount | null;
}

const pushTypes = new Set(["push", "force_push"]);

/**
 * Lists the pushes and force pushes to `repo` at or after `since`, newest
 * first, from the repository activity feed: the one place GitHub records
 * when a push happened and who made it. The feed covers the repository's
 * own branches only, so a push to a fork never appears in it.
 *
 * @param ref Keeps only the pushes to one branch, such as
 * `refs/heads/feat/example`.
 */
export default async function fetchPushes(
  client: Client,
  repo: string,
  since: Date,
  ref?: string,
): Promise<FeedPush[]> {
  const { owner, name } = splitRepo(repo);
  const pushes: FeedPush[] = [];
  const feed = client.pages<FeedEntry>("GET /repos/{owner}/{repo}/activity", {
    owner,
    repo: name,
    per_page: 100,
    ...(ref ? { ref } : {}),
  });
  for await (const entries of feed) {
    for (const entry of entries) {
      const at = new Date(entry.timestamp);
      if (at < since) return pushes;
      if (!pushTypes.has(entry.activity_type)) continue;
      const { ref, before, after, actor } = entry;
      pushes.push({ ref, before, after, at, actor });
    }
  }
  return pushes;
}
