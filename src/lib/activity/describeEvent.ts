import type { ThreadEvent } from "../events/index.js";

/**
 * Writes who did what, such as `alice pushed 2 commits` or `alice assigned
 * bob`. A close reads in the provider's words, such as `alice closed as
 * completed`. Failed checks name the checks rather than who ran them, as in
 * `checks failed (lint)`.
 *
 * @param mark Writes each part that was written on GitHub (a login, a
 * label, a check's name), so a face can set it apart from the words
 * around it; left out, each part stands as it is.
 */
export default function describeEvent(
  event: ThreadEvent,
  mark: (text: string) => string = (text) => text,
): string {
  const actor = mark(event.actor.login);
  switch (event.kind) {
    case "assigned":
      return `${actor} assigned ${mark(event.assignee)}`;
    case "labelled":
      return `${actor} labelled ${mark(event.label)}`;
    case "pushed":
      if (event.commits === undefined) return `${actor} pushed`;
      return `${actor} pushed ${event.commits} commit${event.commits === 1 ? "" : "s"}`;
    case "checksFailed":
      return `checks failed (${event.checks.map(mark).join(", ")})`;
    case "reviewRequested":
      return `${actor} requested review`;
    case "closed":
      return `${actor} ${event.ending.label}`;
    default:
      return `${actor} ${event.kind}`;
  }
}
