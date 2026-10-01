import type { EventLine } from "../../../activity/index.js";
import type { Verdict } from "../../../endings/index.js";
import type { EndingLine } from "../../../finished/index.js";

/** The props every event line takes. */
interface LineProps {
  /**
   * Whether its thread is a pull request in a stack, so the stack mark
   * runs on down the thread's events.
   * Maps to DSL role: margin (cardinality: 1)
   */
  stacked: boolean;
  /** The width of the pane, in display cells. */
  width: number;
}

/**
 * Props for the EventLine component: an event in activity, where no
 * clock runs, or a finished thread's ending, with its verdict.
 */
export type EventLineProps = LineProps &
  (
    | {
        /**
         * The event as activity's list gives it: who did what, and its age.
         * Maps to DSL roles: who did what, age (cardinality: 1, 1)
         */
        line: EventLine;
        state?: never;
      }
    | {
        /**
         * The ending finished gives as a thread's one event: who ended
         * it, how, and its age.
         * Maps to DSL roles: who did what, age (cardinality: 1, 1)
         */
        line: EndingLine & { readonly event?: never };
        /**
         * The verdict of the finished thread the line ends, whose bar
         * runs down to it and ends there; absent where a label exempts
         * the thread.
         * Maps to DSL role: margin (cardinality: 0..1)
         */
        state?: Verdict;
      }
  );
