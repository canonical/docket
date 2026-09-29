import type { EventLine } from "../../../activity/index.js";

/** Props for the EventLine component. */
export interface EventLineProps {
  /**
   * The event as activity's list gives it: who did what, and its age.
   * Maps to DSL roles: who did what, age (cardinality: 1, 1)
   */
  line: EventLine;
  /**
   * Whether its thread is a pull request in a stack, so the stack mark
   * runs on down the thread's events.
   * Maps to DSL role: margin (cardinality: 1)
   */
  stacked: boolean;
  /** The width of the pane, in display cells. */
  width: number;
}
