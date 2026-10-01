import type { Field } from "../../../owed/index.js";

/** Props for the EmptyState component. */
export interface EmptyStateProps {
  /**
   * What the list would hold, stated as absent: `nothing owed`.
   * Maps to DSL role: message (cardinality: 1)
   */
  message: Field;
  /** The width of the pane, in display cells. */
  width: number;
}
