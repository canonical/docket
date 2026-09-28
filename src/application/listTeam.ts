import type { Watched } from "./types.js";

/**
 * The logins `repo`'s settings group as its team, in the order they are
 * written, or none for a repository not watched.
 */
export default function listTeam(
  watched: readonly Watched[],
  repo: string,
): string[] {
  const people = watched.find((each) => each.repo === repo)?.resolved.settings
    .people;
  return [...(people ?? [])]
    .filter(([, group]) => group === "team")
    .map(([login]) => login);
}
