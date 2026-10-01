import type { Team } from "../waits/index.js";
import type { Owner } from "./types.js";

/**
 * Names a requested GitHub team as a list shows it: `you` when the
 * viewer names it among their teams or is among its members, since the
 * review is then theirs to give, and plain text otherwise, a team being
 * no person.
 *
 * @param viewer The login gh is signed in with, when it is known.
 * @param yours The teams the personal file names as the viewer's. docket
 * reads a team's members only from a review request on a thread it holds,
 * so these mark a team whose members it never read.
 */
export default function describeTeam(
  { team, members }: Team,
  viewer: string | undefined,
  yours: readonly string[],
): Owner {
  const you = viewer?.toLowerCase();
  const name = team.toLowerCase();
  const mine =
    yours.some((listed) => listed.toLowerCase() === name) ||
    members.some((login) => login.toLowerCase() === you);
  return mine
    ? { text: team, kind: "person", group: "you" }
    : { text: team, kind: "person" };
}
