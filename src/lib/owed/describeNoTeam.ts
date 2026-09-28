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
 * waits stay right, so the rows still show. The notice names the
 * repositories without a team unless it is every one of them.
 *
 * @param repos The watched repositories by their short names, each with
 * the people in effect for it.
 */
export default function describeNoTeam(
  repos: readonly { readonly name: string; readonly people: People }[],
): { readonly reason: string; readonly recovery: string } | undefined {
  const names = repos
    .filter(({ people }) => ![...people.values()].includes("team"))
    .map(({ name }) => name);
  const last = names.at(-1);
  if (last === undefined) return undefined;
  const listed =
    names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${last}` : last;
  const which = names.length < repos.length ? ` for ${listed}` : "";
  return {
    reason: `no team in docket.yaml${which}, so every comment starts a reply wait`,
    recovery:
      "list the team under people: in the personal file or in the repository's .github/docket.yaml",
  };
}
