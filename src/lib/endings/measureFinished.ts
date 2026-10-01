import type { Settings } from "../config/index.js";
import measureClose from "./measureClose.js";
import type { FinishedThread, Measures } from "./types.js";

/**
 * Measures a finished thread. Time to close comes from the list's own
 * facts. Time to first reply and time to first review need the thread's
 * timeline, which is not read, so they read `unsupported`. A thread
 * carries all three from the start, so measuring the other two later
 * changes no row's shape.
 *
 * @param settings The settings in effect for the thread's repository.
 */
export default function measureFinished(
  thread: FinishedThread,
  settings: Settings,
): Measures {
  return {
    close: measureClose(thread, settings),
    firstResponse: { kind: "firstResponse", state: "unsupported" },
    firstReview: { kind: "firstReview", state: "unsupported" },
  };
}
