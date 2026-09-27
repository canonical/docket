import type { KeyCommand } from "../../hooks/index.js";

/** Props for the HelpOverlay component. */
export interface HelpOverlayProps {
  /**
   * Every command bound, in the order they are bound; the help groups
   * them by what they act on, in the order the groups first appear.
   * Maps to DSL role: key group (cardinality: 5)
   */
  commands: readonly KeyCommand[];
  /**
   * The one line that closes the help: `windows are counted in working
   * time`.
   * Maps to DSL role: closing note (cardinality: 1)
   */
  note: string;
  /** The width of the pane, in display cells. */
  width: number;
}
