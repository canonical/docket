import type { InboxRow as Row } from "../../../inbox/index.js";

/** Props for the InboxRow component. */
export interface InboxRowProps {
  readonly row: Row;
  /** Whether the row is selected, which gives both its lines the selection background. */
  selected?: boolean;
  /** The width of the pane, in display cells. */
  width: number;
}
