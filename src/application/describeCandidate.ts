import { describePerson, describeTeam, type Owner } from "../lib/owed/index.js";
import type { Thread } from "../lib/waits/index.js";
import type { Watched } from "./types.js";

/**
 * Names someone an editor offers as the lists name people: a login with
 * the group its repository's settings give it, and `you` for the viewer.
 * Whether an unlisted person belongs to the organisation is recorded only
 * on what they wrote, so a login found among the authors and writers of
 * `threads` carries that, and anyone else unlisted is outside. A team,
 * `org/team`, is `you` when a review requested of it on those threads
 * lists the viewer among its members, as owed's rows name it, and text
 * otherwise: GitHub gives an editor no other team's members. A repository
 * not watched lists nobody.
 *
 * @param viewer The login gh is signed in with, when it is known.
 * @param threads The threads the view holds, whose writers and requested
 * teams tell who belongs where, besides `thread`'s own.
 */
export default function describeCandidate(
  name: string,
  thread: Thread,
  watched: readonly Watched[],
  viewer: string | undefined,
  threads: readonly Thread[] = [],
): Owner {
  const key = name.toLowerCase();
  const held = [thread, ...threads];
  if (name.includes("/")) {
    const team = held
      .flatMap(({ reviewRequests }) => reviewRequests)
      .flatMap(({ reviewer }) => ("team" in reviewer ? [reviewer] : []))
      .find((each) => each.team.toLowerCase() === key);
    return team
      ? describeTeam({ team: name, members: team.members }, viewer)
      : { text: name, fit: "trimmed" };
  }
  const people =
    watched.find(({ repo }) => repo === thread.repo)?.resolved.settings
      .people ?? new Map();
  const writer = held
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
