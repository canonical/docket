import { describePerson, describeTeam, type Owner } from "../lib/owed/index.js";
import type { Thread } from "../lib/waits/index.js";
import gatherNamed from "./gatherNamed.js";
import type { Named, Watched } from "./types.js";

/**
 * Names someone an editor offers as the lists name people: a login with
 * the group its repository's settings give it, and `you` for the viewer.
 * Whether an unlisted person belongs to the organisation is recorded only
 * on what they wrote, so a login found among the writers of `thread` or
 * of the held threads carries that, and anyone else unlisted is outside.
 * A team, `org/team`, is `you` when the settings' `you.teams` names it or
 * a review requested of it on those threads lists the viewer among its
 * members, as owed's rows name it, and otherwise of the organisation,
 * `internal`, as GitHub offers only the teams of the repository's
 * organisation; it gives an editor no other team's members. A repository
 * not watched lists nobody.
 *
 * @param viewer The login gh is signed in with, when it is known.
 * @param held What the threads the view holds tell, gathered once for
 * all the names an editor offers.
 */
export default function describeCandidate(
  name: string,
  thread: Thread,
  watched: readonly Watched[],
  viewer: string | undefined,
  held: Named = gatherNamed([]),
): Owner {
  const key = name.toLowerCase();
  const own = gatherNamed([thread]);
  const settings = watched.find(({ repo }) => repo === thread.repo)?.resolved
    .settings;
  if (name.includes("/")) {
    const members = (own.teams.get(key) ?? held.teams.get(key))?.members;
    const team = describeTeam(
      { team: name, members: members ?? [] },
      viewer,
      settings?.you.teams ?? [],
    );
    return "group" in team ? team : { ...team, group: "internal" };
  }
  return describePerson(
    own.writers.get(key) ??
      held.writers.get(key) ?? { login: name, type: "user" },
    settings?.people ?? new Map(),
    viewer,
  );
}
