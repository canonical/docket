import type { Field, Heading } from "../../../owed/index.js";

/** Props for the GroupHeading component. */
export interface GroupHeadingProps {
  /**
   * The group's name: an owner, a person with their group or `unassigned`;
   * a repository; a stack such as `example stack 3 · 3 PRs → main`;
   * `NOT IN A STACK`; or a kind such as `ISSUES`; in the help, the object
   * its keys act on, such as `Mode`.
   * Maps to DSL role: heading text (cardinality: 1)
   */
  heading: Heading;
  /**
   * On the pinned heading only, where the rows shown under it start in
   * the group, and the group's size: `3 of 8`.
   * Maps to DSL role: pinned count (cardinality: 0..1)
   */
  count?: Field;
  /** The width of the pane, in display cells. */
  width: number;
}
