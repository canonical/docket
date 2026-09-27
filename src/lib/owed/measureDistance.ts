import {
  hourMilliseconds,
  measureDuration,
  measureWorkingTime,
  type WorkingClock,
} from "../clock/index.js";
import type { Wait } from "../waits/index.js";
import { soonShare } from "./constants.js";
import type { WaitState } from "./types.js";

/** Where a wait stands against its target, and how that reads. */
export interface Distance {
  readonly state: WaitState;
  /** Working time past due as a share of the target; negative while time is left. */
  readonly overdue: number;
  /** `1d over` or `9h left`. */
  readonly text: string;
}

/**
 * Measures the working time between a wait's due instant and `now`, the
 * same clock the target is counted on, so a weekend neither brings a wait
 * closer to its target nor pushes it further past.
 *
 * The distance is written in whole days from one working day on, and in
 * whole hours below it, both rounded down: a wait due within the hour
 * reads `0h left`.
 */
export default function measureDistance(
  wait: Wait,
  time: WorkingClock,
  now: Date,
): Distance {
  const gap = wait.over
    ? measureWorkingTime(wait.due, now, time)
    : measureWorkingTime(now, wait.due, time);
  const target = measureDuration(wait.target, time);
  const share = gap / target;
  const hours = Math.floor(gap / hourMilliseconds);
  const amount = hours >= 24 ? `${Math.floor(hours / 24)}d` : `${hours}h`;
  if (wait.over)
    return { state: "over", overdue: share, text: `${amount} over` };
  return {
    state: share < soonShare ? "soon" : "onTrack",
    overdue: -share,
    text: `${amount} left`,
  };
}
