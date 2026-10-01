import {
  addWorkingTime,
  type Duration,
  measureDuration,
} from "../clock/index.js";
import type { Settings } from "../config/index.js";
import type { FinishedThread, TimedEnding } from "./types.js";

/**
 * Times each ending against `window` of working time, as events are
 * timed, so a window means one thing for both: a thread is finished
 * within the window at `now` while its `until` is `now` or later, and its
 * ending is then an event in the same window.
 *
 * @param settings The settings in effect for the threads' repository.
 */
export default function timeEndings(
  finished: readonly FinishedThread[],
  window: Duration,
  settings: Settings,
): TimedEnding[] {
  const { time } = settings;
  const length = measureDuration(window, time);
  return finished.map((thread) => ({
    thread,
    until: addWorkingTime(thread.ending.at, length, time),
  }));
}
