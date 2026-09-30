import type { People } from "../config/index.js";
import type { WindowEvent } from "../events/index.js";
import {
  describeOwners,
  describePerson,
  type Field,
  threadWords,
} from "../owed/index.js";
import { classify } from "../people/index.js";
import type { Thread, ThreadSummary } from "../waits/index.js";
import describeAge from "./describeAge.js";
import describeEvent from "./describeEvent.js";
import type { ThreadRow } from "./types.js";

/** What an event acted on, as GitHub writes it, when it names anything. */
function findTarget(event: WindowEvent): Field | undefined {
  switch (event.kind) {
    case "assigned":
      return { text: event.assignee, kind: "person" };
    case "labelled":
      return { text: event.label, kind: "identifier" };
    case "checksFailed":
      return { text: event.checks.join(", "), kind: "identifier" };
    default:
      return undefined;
  }
}

/**
 * Builds the row for one thread and nests its events under it.
 *
 * @param thread The thread as its newest event names it.
 * @param repo The short name of the thread's repository.
 * @param facts The thread's recorded facts, when given; they name its
 * author, its owners, the assignees that are not bots, and whether it is
 * a draft.
 * @param events The thread's events, newest first.
 * @param viewer The login gh is signed in with, when it is known, which
 * marks the viewer among the author, the owners and the actors.
 */
export default function buildThreadRow(
  thread: ThreadSummary,
  repo: string,
  facts: Thread | undefined,
  people: People,
  events: readonly [WindowEvent, ...WindowEvent[]],
  now: Date,
  viewer?: string,
): ThreadRow {
  const lines = events.map((event) => {
    const text = describeEvent(event);
    const actor =
      event.kind === "checksFailed"
        ? undefined
        : describePerson(event.actor, people, viewer);
    // describeEvent writes the actor first, then one space, then the action.
    const action = actor ? text.slice(actor.text.length + 1) : text;
    const target = findTarget(event);
    return {
      event,
      text: { text, kind: "words" as const },
      ...(actor ? { actor } : {}),
      action: { text: action, kind: "words" as const },
      ...(target ? { target } : {}),
      age: { text: describeAge(event.at, now), kind: "figure" as const },
    };
  });
  const owners = facts?.assignees
    .filter((account) => classify(account, people) !== "bot")
    .map((account) => describePerson(account, people, viewer));
  return {
    thread,
    repo,
    stacked: thread.stack !== undefined,
    reference: { text: `${repo}#${thread.number}`, kind: "identifier" },
    kind: { text: threadWords[thread.kind], kind: "words" },
    distance: { text: describeAge(events[0].at, now), kind: "figure" },
    title: { text: thread.title, kind: "title" },
    ...(facts ? { author: describePerson(facts.author, people, viewer) } : {}),
    ...(facts?.draft ? { draft: { text: "draft", kind: "words" } } : {}),
    ...(owners ? describeOwners(owners) : {}),
    events: lines,
  };
}
