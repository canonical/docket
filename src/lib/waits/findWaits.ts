import {
  addWorkingTime,
  type Duration,
  measureDuration,
} from "../clock/index.js";
import type { Settings } from "../config/index.js";
import { classify } from "../people/index.js";
import findResponseStart from "./findResponseStart.js";
import type { Thread, Wait, WaitKind } from "./types.js";

/**
 * Lists every wait running on a thread at `now`, measured on the working
 * clock of the thread's repository.
 *
 * A closed or merged thread has none, whatever the reason it closed. An
 * open thread waits for a reply while someone outside the team has the
 * last word, and it always carries the close clock from its creation, drafts
 * included, unless one of its labels is listed in `exempt.close`.
 *
 * @param settings The settings in effect for the thread's repository.
 */
export default function findWaits(
  thread: Thread,
  settings: Settings,
  now: Date,
): Wait[] {
  if (!thread.open) return [];
  const { people, time, targets, exempt } = settings;
  // Bots never own a wait, so an assigned bot leaves the wait to the rest.
  const assignees = thread.assignees
    .filter((account) => classify(account, people) !== "bot")
    .map(({ login }) => login);
  const measure = (
    kind: WaitKind,
    started: Date,
    target: Duration,
    owners: readonly string[],
  ): Wait => {
    // The due instant is found by adding the target, whose cost follows
    // the target's length, never by measuring the whole span to `now`.
    const due = addWorkingTime(started, measureDuration(target, time), time);
    return { thread, kind, owners, started, target, due, over: now > due };
  };
  const waits: Wait[] = [];
  const response = findResponseStart(thread, people);
  if (response) {
    waits.push(
      measure("response", response, targets.nextMove.response, assignees),
    );
  }
  // GitHub treats label names that differ only in case as the same label.
  const exempted = new Set(exempt.close.map((label) => label.toLowerCase()));
  if (!thread.labels.some((label) => exempted.has(label.toLowerCase()))) {
    waits.push(
      measure("close", thread.createdAt, targets.close[thread.kind], assignees),
    );
  }
  return waits;
}
