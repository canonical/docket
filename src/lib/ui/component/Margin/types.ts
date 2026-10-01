import type { Verdict } from "../../../endings/index.js";
import type { WaitState } from "../../../owed/index.js";

/** Props for the Margin component. */
export interface MarginProps {
  /**
   * Where the wait stands against its target, or, in finished, where the
   * thread ended against it, which gives the bar its weight and colour.
   * Absent in activity, where nothing runs a clock, and on a finished
   * thread a label exempts, so the column is blank.
   * Maps to DSL role: state bar (cardinality: 0..1)
   */
  state?: WaitState | Verdict;
  /**
   * Whether the pull request sits in a stack, drawn as the stack mark.
   * Maps to DSL role: stack mark (cardinality: 0..1)
   */
  stacked: boolean;
  /** How many lines the margin spans. */
  lines: number;
  /**
   * Whether the item ends on the margin's last line, where the bar then
   * stops mid-line; false when more of the item follows, such as the
   * accordion under its row.
   */
  ends: boolean;
}
