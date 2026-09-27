import type { ReactNode } from "react";

/** Props for the Pane layout. */
export interface PaneProps {
  /** The width of the terminal, in display cells. */
  width: number;
  /**
   * The first line: where you are.
   * Maps to DSL role: pane-header (cardinality: 1)
   */
  header: ReactNode;
  /**
   * The list region: the list, or what stands in for it. It is the only
   * part that grows or shrinks with the terminal.
   * Maps to DSL role: list region (cardinality: 1)
   */
  children: ReactNode;
  /**
   * The summary of the list, or a blank line when there is none.
   * Maps to DSL role: counts_line (cardinality: 0..1)
   */
  counts?: ReactNode;
  /**
   * docket's own state.
   * Maps to DSL role: status_line (cardinality: 1)
   */
  status: ReactNode;
  /**
   * The reminder of the main keys.
   * Maps to DSL role: key_bar (cardinality: 1)
   */
  keys: ReactNode;
  /**
   * The help, which takes the whole area under the header while it is
   * open.
   * Maps to DSL role: help_overlay (cardinality: 0..1)
   */
  help?: ReactNode;
}
