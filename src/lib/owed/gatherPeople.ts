import type { People } from "../config/index.js";
import type { Author } from "../people/index.js";
import type { Thread } from "../waits/index.js";

/**
 * Gives each login of a repository one group, wherever the login appears:
 * the group the settings give it, and otherwise `internal` once GitHub
 * marks it a member of the organisation on anything it wrote on the
 * repository's threads. GitHub records membership only on what an account
 * wrote, so without this an assignee or a reviewer would read as external
 * on the very row that names them internal as its author.
 *
 * A bot keeps its own group whatever GitHub marks it, as the settings'
 * fallback puts a bot first.
 *
 * @param threads The repository's threads.
 * @param people The people of the repository's settings.
 * @param authors The authors of anything else the repository holds, such
 * as its finished threads.
 */
export default function gatherPeople(
  threads: readonly Thread[],
  people: People,
  authors: readonly Author[] = [],
): People {
  const gathered = new Map(people);
  const written = threads.flatMap((thread) =>
    [thread, ...thread.comments, ...thread.reviews].map(({ author }) => author),
  );
  for (const author of [...written, ...authors]) {
    const login = author.login.toLowerCase();
    if (author.member && author.type !== "bot" && !gathered.has(login)) {
      gathered.set(login, "internal");
    }
  }
  return gathered;
}
