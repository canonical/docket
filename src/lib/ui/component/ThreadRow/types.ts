import type { ThreadRow as ActivityThread } from "../../../activity/index.js";
import type { WaitRow } from "../../../owed/index.js";

/** Props for the ThreadRow component. */
export interface ThreadRowProps {
  /**
   * The thread as its list gives it, whole: owed's running wait, which
   * names the kind of thread and the kind of wait and whose figure is the
   * distance to target, or activity's thread, whose kind is the kind of
   * thread and whose figure is the age of its newest event.
   * Maps to DSL roles: margin, thread reference, kind of thread, kind of
   * wait, author, distance, title, draft, troubled field, owner, owners
   * line (cardinality: 1, 1, 1, 0..1, 0..1, 1, 1, 0..1, 0..*, 0..1, 0..1)
   */
  row: WaitRow | ActivityThread;
  /** Whether the row is selected, which gives each of its lines the selection background. */
  selected?: boolean;
  /**
   * Whether more of the item follows the row, such as its accordion, so
   * the state bar runs on rather than ending on the row's last line.
   */
  continued?: boolean;
  /** The width of the pane, in display cells. */
  width: number;
}
