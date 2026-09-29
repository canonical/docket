import type { People } from "../config/index.js";
import type { WindowEvent } from "../events/index.js";
import { describeOwners, describePerson } from "../owed/index.js";
import { classify } from "../people/index.js";
import type { Thread, ThreadSummary } from "../waits/index.js";
import { threadWords } from "./constants.js";
import describeAge from "./describeAge.js";
import describeEvent from "./describeEvent.js";
import type { ThreadRow } from "./types.js";

/**
 * Builds the row for one thread and nests its events under it.
 *
 * @param thread The thread as its newest event names it.
 * @param repo The short name of the thread's repository.
 * @param facts The thread's recorded facts, when given; they name its
 * owners, the assignees that are not bots, and whether it is a draft.
 * @param events The thread's events, newest first.
 * @param viewer The login gh is signed in with, when it is known, which
 * marks the viewer among the owners.
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
  const lines = events.map((event) => ({
    event,
    text: { text: describeEvent(event), fit: "trimmed" as const },
    age: { text: describeAge(event.at, now), fit: "trimmed" as const },
  }));
  const owners = facts?.assignees
    .filter((account) => classify(account, people) !== "bot")
    .map((account) => describePerson(account, people, viewer));
  return {
    thread,
    repo,
    stacked: thread.stack !== undefined,
    reference: { text: `${repo}#${thread.number}`, fit: "trimmed" },
    kind: { text: threadWords[thread.kind], fit: "trimmed" },
    distance: { text: describeAge(events[0].at, now), fit: "trimmed" },
    title: { text: thread.title, fit: "trimmed" },
    ...(facts?.draft ? { draft: { text: "draft", fit: "trimmed" } } : {}),
    ...(owners ? describeOwners(owners) : {}),
    events: lines,
  };
}
