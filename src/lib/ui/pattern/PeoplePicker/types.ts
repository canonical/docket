import type { Owner } from "../../../owed/index.js";
import type { NoticeProps } from "../../component/index.js";

/** One person or team the picker offers, and whether it is in the set. */
export interface PickerOption {
  /**
   * A person or a team, `org/team`, with their group, drawn behind their
   * mark and in their hue: a team the viewer is in `◉`, another of the
   * organisation's teams `◐`; a name without a group is drawn as text.
   */
  readonly owner: Owner;
  /** Whether applying sets it: `☑` when it is, `☐` when it is not. */
  readonly ticked: boolean;
}

/** Props for the PeoplePicker pattern. */
export interface PeoplePickerProps {
  /**
   * The text typed so far, which narrows the options.
   * Maps to DSL role: typed text (cardinality: 0..1)
   */
  filter: string;
  /** Hears the text each time the typing changes it. */
  onFilter: (filter: string) => void;
  /**
   * The options that match the filter, in the order offered, or none yet
   * while they are read from GitHub: the picker then says `loading…`.
   * Maps to DSL role: option (cardinality: 1..*)
   */
  options?: readonly PickerOption[];
  /** The place of the option under the cursor, which takes the selection background. */
  cursor: number;
  /**
   * Why GitHub refused the change, and what to do about it, drawn under
   * the options.
   * Maps to DSL role: notice (cardinality: 0..1)
   */
  notice?: Omit<NoticeProps, "width">;
  /** The width of the pane, in display cells. */
  width: number;
}
