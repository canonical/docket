import type { Field } from "../../../owed/index.js";

/** Props for the Loading component. */
export interface LoadingProps {
  /**
   * What is being read, stated as under way: `refresh in progress…`.
   * Maps to DSL role: message (cardinality: 1)
   */
  label: Field;
  /** The width of the line the label is drawn on, in display cells. */
  width: number;
}
