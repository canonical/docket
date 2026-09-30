import type { Field } from "../../../owed/index.js";

/** Props for the CountsLine component. */
export interface CountsLineProps {
  /**
   * The summary the mode's list gives: `3 over · 2 soon · 6 on track` in
   * owed, `9 threads · 23 events` in activity.
   * Maps to DSL role: owed summary, activity summary (cardinality: 1)
   */
  summary: Field;
  /** The width of the pane, in display cells. */
  width: number;
}
