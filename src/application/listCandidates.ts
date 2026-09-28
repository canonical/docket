import type { Thread } from "../lib/waits/index.js";
import type { Candidates } from "./types.js";
import type { WriteAction } from "./writeSet.js";

/** What an editor offers people from, besides what GitHub gives it. */
export interface CandidateSources {
  readonly action: WriteAction;
  readonly thread: Thread;
  /** The logins the thread's repository groups as its team. */
  readonly team: readonly string[];
  /** The set GitHub holds, and whom it offers. */
  readonly candidates: Candidates;
}

/** The people who wrote on the thread, in the order they first wrote. */
const listThreadPeople = ({ author, comments, reviews }: Thread) =>
  [author, ...comments.map((message) => message.author)]
    .concat(reviews.map((review) => review.author))
    .filter(({ type }) => type !== "bot")
    .map(({ login }) => login);

/**
 * Everyone an editor offers, in its order and each once, whatever the
 * case of their name: the set GitHub holds comes first, as it is
 * ticked when the editor opens. Assigning then offers the team, the people
 * who wrote on the thread, and everyone else GitHub can assign; requesting
 * review offers whom GitHub gives, in its order: its suggestions, the
 * collaborators, then the teams.
 */
export default function listCandidates({
  action,
  thread,
  team,
  candidates,
}: CandidateSources): string[] {
  const { current, offered } = candidates;
  const names =
    action === "assign"
      ? [...current, ...team, ...listThreadPeople(thread), ...offered]
      : [...current, ...offered];
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
