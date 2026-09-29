import type { Author } from "../lib/people/index.js";
import type { Team, Thread } from "../lib/waits/index.js";
import type { Named } from "./types.js";

/**
 * Gathers once what a set of threads tells about the people and teams an
 * editor offers: each account that wrote on them, and each team a review
 * was requested of, by its lowercase name, the first one met kept. An
 * editor draws on every tick and key, so its options look names up here
 * rather than walking every thread for each name.
 */
export default function gatherNamed(threads: readonly Thread[]): Named {
  const writers = new Map<string, Author>();
  const teams = new Map<string, Team>();
  for (const thread of threads) {
    for (const { author } of [thread, ...thread.comments, ...thread.reviews]) {
      const key = author.login.toLowerCase();
      if (!writers.has(key)) writers.set(key, author);
    }
    for (const { reviewer } of thread.reviewRequests) {
      if (!("team" in reviewer)) continue;
      const key = reviewer.team.toLowerCase();
      if (!teams.has(key)) teams.set(key, reviewer);
    }
  }
  return { writers, teams };
}
