import type { Field } from "../../../owed/index.js";

/** Props for the PaneHeader subcomponent. */
export interface PaneHeaderProps {
  /**
   * What the pane shows, on the left: the mode's name (`owed`,
   * `activity`), an editor's title, or `help`.
   * Maps to DSL role: mode name, editor title, help title (cardinality: 1)
   */
  title: Field;
  /**
   * The mode's address, right-aligned, read like the text address: its
   * grouping, `one list` or such as `by owner`, and in activity its window
   * first, such as `24h · by kind`. Absent for an editor and the help.
   * Maps to DSL role: address (cardinality: 0..1)
   */
  address?: Field;
  /**
   * The mode's fixed order, after the address and dimmed, such as
   * `overdue first`. It gives way first when the line is too short.
   * Maps to DSL role: sort (cardinality: 0..1)
   */
  sort?: Field;
  /** The width of the pane, in display cells. */
  width: number;
}
