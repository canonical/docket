import { describePerson, type Owner } from "../lib/owed/index.js";
import type { Thread } from "../lib/waits/index.js";
import type { Watched } from "./types.js";

/**
 * Names someone an editor offers as the lists name people: a login with
 * the group its repository's settings give it, and `you` for the viewer.
 * Whether an unlisted person belongs to the organisation is recorded only
 * on what they wrote, so a login found among the authors and writers of
 * `threads` carries that, and anyone else unlisted is outside. A team,
 * `org/team`, stays text: GitHub gives an editor no team's members. A
 * repository not watched lists nobody.
 *
 * @param viewer The login gh is signed in with, when it is known.
 * @param threads The threads the view holds, whose writers tell who
 * belongs to the organisation, besides `thread`'s own.
 */
export default function describeCandidate(
  name: string,
  thread: Thread,
  watched: readonly Watched[],
  viewer: string | undefined,
  threads: readonly Thread[] = [],
): Owner {
  if (name.includes("/")) return { text: name, fit: "trimmed" };
  const people =
    watched.find(({ repo }) => repo === thread.repo)?.resolved.settings
      .people ?? new Map();
  const key = name.toLowerCase();
  const writer = [thread, ...threads]
    .flatMap(({ author, comments, reviews }) => [
      author,
      ...comments.map((message) => message.author),
      ...reviews.map((message) => message.author),
    ])
    .find(({ login }) => login.toLowerCase() === key);
  return describePerson(
    writer ?? { login: name, type: "user" },
    people,
    viewer,
  );
}
