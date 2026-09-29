import type { People } from "../config/index.js";

/**
 * What owed says above its rows while a watched repository's settings
 * list nobody as team, or nothing while every one lists a team. A
 * repository's own file owns `people` whenever it declares it, so each
 * repository is read on its own settings, never on the personal file's.
 *
 * Without a team every login counts as outside it, so every comment
 * starts a reply wait, the maintainers' own included: the list is wrong
 * rather than full, and nothing on a row says so. The close and review
 * waits stay right, so the rows still show. The notice names no
 * repository, and sends the reader to `docket config`, which names each
 * one that lists no team.
 *
 * @param people The people in effect for each watched repository.
 */
export default function describeNoTeam(
  people: readonly People[],
): { readonly reason: string; readonly recovery: string } | undefined {
  if (people.every((listed) => [...listed.values()].includes("team"))) {
    return undefined;
  }
  return {
    reason: "no team in docket.yaml, so every comment starts a reply wait",
    recovery:
      "list the team under people: in the personal file or the repository's .github/docket.yaml, then run docket config",
  };
}
