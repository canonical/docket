import type { Field } from "../../../owed/index.js";

/** Props for the CountsLine component. */
export interface CountsLineProps {
  /**
   * The summary the mode's list gives: `3 over · 2 soon · 6 on track` in
   * owed, `9 threads · 23 events` in activity.
   * Maps to DSL role: owed summary, activity summary (cardinality: 1)
   */
  summary: Field;
  /**
   * Where the selection is, right-aligned: `3/12`, or `1/4/12` with
   * groups, the first of its group's four, of twelve in all. Absent when
   * nothing is listed.
   * Maps to DSL role: position (cardinality: 0..1)
   */
  position?: Field;
  /** The width of the pane, in display cells. */
  width: number;
}
