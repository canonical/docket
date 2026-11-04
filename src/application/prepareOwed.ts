import { gatherPeople, type RepoWaits } from "../lib/owed/index.js";
import { findWaits, type Thread } from "../lib/waits/index.js";
import type { Watched } from "./types.js";

/** Finds waits and people for a snapshot, independent of the clock. */
export default function prepareOwed(
  threads: readonly Thread[],
  watched: readonly Watched[],
): readonly RepoWaits[] {
  return watched.map((repo) => {
    const { settings, repositoryErrors } = repo.resolved;
    const own = threads.filter((thread) => thread.repo === repo.repo);
    return {
      repo,
      time: settings.time,
      people: gatherPeople(own, settings.people),
      yours: settings.you.teams,
      waits: own.flatMap((thread) => findWaits(thread, settings)),
      invalidFile: repositoryErrors.length > 0,
    };
  });
}
