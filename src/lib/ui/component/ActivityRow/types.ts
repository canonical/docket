import type { ThreadRow } from "../../../activity/index.js";

/** Props for the ActivityRow component. */
export interface ActivityRowProps {
  /**
   * The thread as activity's list gives it: its reference, kind, the age
   * of its newest event, title, owners and marks, whole.
   * Maps to DSL roles: margin, thread reference, kind, distance, title,
   * owner, troubled field (cardinality: 1, 1, 1, 1, 1, 0..1, 0..*)
   */
  row: ThreadRow;
  /** The width of the pane, in display cells. */
  width: number;
}
