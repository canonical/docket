import type { People } from "../config/index.js";
import { classify } from "../people/index.js";
import type { Thread } from "./types.js";

/**
 * Finds when the thread started waiting for a reply from the team, or
 * `undefined` when it waits for none.
 *
 * The opening, the comments and the reviews are read in time order. A
 * message from someone outside the team starts the wait, unless one
 * already runs, so the wait dates from the earliest message still
 * unanswered. Any team member's message ends it, not only an assignee's.
 * Bots neither start nor end it: automation that comments on every thread
 * owes and receives no reply.
 */
export default function findResponseStart(
  thread: Thread,
  people: People,
): Date | undefined {
  const messages = [
    { author: thread.author, at: thread.createdAt },
    ...thread.comments,
    // A review is the next move as much as a comment is, so a team
    // member's review is a reply, and a review from outside asks for one.
    ...thread.reviews,
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  let started: Date | undefined;
  for (const { author, at } of messages) {
    const group = classify(author, people);
    if (group === "team") started = undefined;
    // A bot waits for no reply, and its messages would only add noise, so
    // a bot's opening, comment or review neither starts nor ends the wait.
    // A thread a bot opened still carries the close clock.
    else if (group !== "bot") started ??= at;
  }
  return started;
}
