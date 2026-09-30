import type { ListBlock } from "../../types.js";

/** Props for the ScrolledList layout. */
export interface ScrolledListProps {
  /**
   * The list's blocks, in order.
   * Maps to DSL role: group_heading, thread entry (cardinality: 0..*)
   */
  blocks: readonly ListBlock[];
  /**
   * The first block that must be whole in view: the selected row, or the
   * heading above it when the row is the first of its group.
   */
  from: number;
  /** The last block that must be whole in view: the selected row. */
  to: number;
  /** The lines the list has. */
  height: number;
  /**
   * The first block shown when the list is drawn anew, such as after the
   * help or a pane too small took its place; the top when absent.
   */
  first?: number;
  /**
   * Told, after each draw, how many rows the list shows, headings not
   * counted, which is how far a page moves, and the place of the first
   * block it shows, which `first` takes when the list is drawn anew.
   */
  onShown: (rows: number, first: number) => void;
  /** The width of the pane, in display cells. */
  width: number;
}
