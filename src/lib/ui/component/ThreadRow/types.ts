import type { WaitRow } from "../../../owed/index.js";

/** Props for the ThreadRow component. */
export interface ThreadRowProps {
  /**
   * The running wait, as owed's list gives it: its reference, kind,
   * distance, title, owners and marks, whole.
   * Maps to DSL roles: margin, thread reference, kind, distance, title,
   * owner, troubled field (cardinality: 1, 1, 1, 1, 1, 1, 0..*)
   */
  row: WaitRow;
  /** Whether the row is selected, which gives each of its lines the selection background. */
  selected?: boolean;
  /** The width of the pane, in display cells. */
  width: number;
}
