import type { Team } from "../waits/index.js";
import type { Owner } from "./types.js";

/**
 * Names a requested GitHub team as a list shows it: `you` when the viewer
 * is among its members, since the review is then theirs to give, and
 * plain text otherwise, a team being no person.
 *
 * @param viewer The login gh is signed in with, when it is known.
 */
export default function describeTeam(
  { team, members }: Team,
  viewer: string | undefined,
): Owner {
  const you = viewer?.toLowerCase();
  const member = members.some((login) => login.toLowerCase() === you);
  return member
    ? { text: team, fit: "trimmed", group: "you" }
    : { text: team, fit: "trimmed" };
}
