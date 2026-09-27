import type { ThreadEvent } from "../events/index.js";

/** Writes who did what, such as `alice pushed 2 commits` or `alice assigned bob`. */
export default function describeEvent(event: ThreadEvent): string {
  const actor = event.actor.login;
  switch (event.kind) {
    case "assigned":
      return `${actor} assigned ${event.assignee}`;
    case "labelled":
      return `${actor} labelled ${event.label}`;
    case "pushed":
      return `${actor} pushed ${event.commits} commit${event.commits === 1 ? "" : "s"}`;
    case "reviewRequested":
      return `${actor} requested review`;
    default:
      return `${actor} ${event.kind}`;
  }
}
