import type { People } from "../lib/config/index.js";
import { gatherPeople } from "../lib/owed/index.js";
import type { Thread } from "../lib/waits/index.js";
import type { Watched } from "./types.js";

/**
 * Each login's group in one repository, as activity's rows name people:
 * its settings' people, with anyone GitHub marks a member on what they
 * wrote on its threads. A repository not watched lists nobody.
 *
 * @param repo The repository, `owner/name`.
 * @param threads The threads the view holds, of every repository.
 */
export default function findPeople(
  repo: string,
  threads: readonly Thread[],
  watched: readonly Watched[],
): People {
  const settings = watched.find((each) => each.repo === repo)?.resolved
    .settings;
  return gatherPeople(
    threads.filter((thread) => thread.repo === repo),
    settings?.people ?? new Map(),
  );
}
