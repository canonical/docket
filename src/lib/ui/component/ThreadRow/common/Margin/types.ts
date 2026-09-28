import type { WaitState } from "../../../../../owed/index.js";

/** Props for the Margin subcomponent. */
export interface MarginProps {
  /**
   * Where the wait stands against its target, which colours the state
   * marker.
   * Maps to DSL role: state marker (cardinality: 0..1)
   */
  state: WaitState;
  /**
   * Whether the pull request sits in a stack, drawn as the stack rule.
   * Maps to DSL role: stack rule (cardinality: 0..1)
   */
  stacked: boolean;
  /** How many lines the row takes, which the margin spans. */
  lines: number;
}
