import type { EventLine } from "../../../activity/index.js";

/** Props for the EventLine component. */
export interface EventLineProps {
  /**
   * The event as activity's list gives it: who did what, and its age.
   * Maps to DSL roles: who did what, age (cardinality: 1, 1)
   */
  line: EventLine;
  /** The width of the pane, in display cells. */
  width: number;
}
