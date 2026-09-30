import { measureDuration, measureWorkingTime } from "../clock/index.js";
import type { Settings } from "../config/index.js";
import { isExempt } from "../waits/index.js";
import type { FinishedThread, Measure } from "./types.js";

/**
 * Measures time to close: the close clock read at the thread's end, from
 * when it was opened to when it was merged or closed, drafts included, on
 * the working clock of its repository against the close target for its
 * kind. A thread one of whose labels the settings exempt has none.
 *
 * @param settings The settings in effect for the thread's repository.
 */
export default function measureClose(
  thread: FinishedThread,
  settings: Settings,
): Measure {
  const { time, targets, exempt } = settings;
  if (isExempt(thread.labels, exempt)) {
    return { kind: "close", state: "notApplicable" };
  }
  const started = thread.createdAt;
  const ended = thread.ending.at;
  const target = targets.close[thread.kind];
  const length = measureDuration(target, time);
  const workingTime = measureWorkingTime(started, ended, time);
  const overdue = (workingTime - length) / length;
  return {
    kind: "close",
    state: "measured",
    started,
    ended,
    workingTime,
    target,
    overdue,
    verdict: overdue > 0 ? "over" : "within",
  };
}
