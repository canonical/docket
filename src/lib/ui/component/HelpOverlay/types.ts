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
   * time`. Absent where no window applies, as on setup.
   * Maps to DSL role: closing note (cardinality: 0..1)
   */
  note?: string;
  /** The width of the pane, in display cells. */
  width: number;
  /** The lines the help has: the pane's, but for the header's. */
  height: number;
  /**
   * The place, among the help's groups and key lines, of the first
   * shown; the top when absent. Past the last that fills the help, the
   * help shows its end.
   */
  first?: number;
  /**
   * Told, after each draw, how many key lines the help shows, and the
   * place of the first thing it shows.
   */
  onShown?: (rows: number, first: number) => void;
}
