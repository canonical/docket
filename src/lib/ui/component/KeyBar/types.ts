import type { KeyCommand } from "../../hooks/index.js";

/** Props for the KeyBar component. */
export interface KeyBarProps {
  /**
   * The commands the keys run now, in the order they are bound. Those
   * with a hint are shown.
   * Maps to DSL role: key hint (cardinality: 1..*)
   */
  commands: readonly KeyCommand[];
  /** The width of the pane, in display cells. */
  width: number;
}
