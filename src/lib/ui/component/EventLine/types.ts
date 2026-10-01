import type { EventLine } from "../../../activity/index.js";
import type { Verdict } from "../../../endings/index.js";
import type { EndingLine } from "../../../finished/index.js";

/** Props for the EventLine component. */
export interface EventLineProps {
  /**
   * The event as activity's list gives it, or the ending finished gives as
   * a thread's one event: who did what, and its age.
   * Maps to DSL roles: who did what, age (cardinality: 1, 1)
   */
  line: EventLine | EndingLine;
  /**
   * The verdict of the finished thread the line ends, whose bar runs down
   * to it and ends there; absent in activity, where no clock runs, and
   * where a label exempts the thread.
   * Maps to DSL role: margin (cardinality: 1)
   */
  state?: Verdict;
  /**
   * Whether its thread is a pull request in a stack, so the stack mark
   * runs on down the thread's events.
   * Maps to DSL role: margin (cardinality: 1)
   */
  stacked: boolean;
  /** The width of the pane, in display cells. */
  width: number;
}
