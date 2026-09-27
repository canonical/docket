/** Props for the PaneHeader subcomponent. */
export interface PaneHeaderProps {
  /**
   * What the pane shows, drawn in bold on the left: the mode's name
   * (`owed`, `activity`) or `help`.
   * Maps to DSL role: mode name, help title (cardinality: 1)
   */
  title: string;
  /**
   * The mode's address, right-aligned: its grouping, such as `by owner`,
   * and in activity its window first, such as `24h · by kind`. Absent for
   * owed without a grouping, and for help.
   * Maps to DSL role: address (cardinality: 0..1)
   */
  address?: string;
  /** The width of the pane, in display cells. */
  width: number;
}
