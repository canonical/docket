import {
  hourMilliseconds,
  measureDuration,
  type WorkingClock,
} from "../clock/index.js";
import type { Wait } from "../waits/index.js";
import { waitWords } from "./constants.js";
import describeOwners from "./describeOwners.js";
import measureDistance from "./measureDistance.js";
import type { WaitRow } from "./types.js";

/**
 * Builds the row for one running wait.
 *
 * @param repo The short name of the wait's repository, as references write it.
 * @param time The working clock of the wait's repository.
 */
export default function buildRow(
  wait: Wait,
  repo: string,
  time: WorkingClock,
  now: Date,
): WaitRow {
  const { thread } = wait;
  const { state, overdue, text } = measureDistance(wait, time, now);
  return {
    wait,
    repo,
    state,
    overdue,
    targetHours: measureDuration(wait.target, time) / hourMilliseconds,
    stacked: thread.stack !== undefined,
    reference: { text: `${repo}#${thread.number}`, fit: "trimmed" },
    kind: { text: waitWords[wait.kind], fit: "trimmed" },
    distance: { text, fit: "trimmed" },
    title: { text: thread.title, fit: "trimmed" },
    ...(thread.draft ? { draft: { text: "draft", fit: "trimmed" } } : {}),
    ...describeOwners(wait.owners),
  };
}
