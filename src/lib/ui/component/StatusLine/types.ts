import type { AttentionState, CacheStatus } from "../../../cache/index.js";
import type { Owner } from "../../../owed/index.js";

/**
 * What the status line says, and what kind of message it is: the kind
 * decides its colour, and ranks it against the others.
 */
export interface StatusMessage {
  readonly kind:
    | "error"
    | "actionFailed"
    | "action"
    | "progress"
    | "refreshing"
    | "notice"
    | "freshness";
  readonly text: string;
  /** The people the message names, drawn after its words behind their marks. */
  readonly people?: readonly Owner[];
}

/** The result of something the user did, such as opening a thread. */
export interface ActionResult {
  /** Whether it failed: the line then marks it `✗`, else `✓`. */
  readonly failed: boolean;
  /** What happened, in plain words, such as `could not open the browser`. */
  readonly text: string;
  /**
   * The people it happened to, drawn after the words behind their marks
   * and in their hues, as in `✓ assigned ◐ erin`.
   */
  readonly people?: readonly Owner[];
  /** When it happened: the line shows it for 5 seconds from then. */
  readonly at: Date;
}

/** How far reading the details asked for has come. */
export interface DetailsCount {
  /** How many of them have an answer. */
  readonly read: number;
  /** How many are asked for. */
  readonly asked: number;
}

/** Props for the StatusLine component. */
export interface StatusLineProps {
  /**
   * The cache's state, or none while docket has no cache: the line then
   * shows only an action's result.
   */
  status?: CacheStatus;
  /** The result of the user's last action, if any. */
  action?: ActionResult;
  /**
   * Whether anyone is using the pane, which an idle pane's freshness
   * says, with the key that wakes it. Active when not given.
   */
  attention?: AttentionState;
  /**
   * Whether reading details spent the hour's budget for them, which the
   * right side of an active pane then says.
   */
  detailsPaused?: boolean;
  /**
   * How many of the details asked for are read, while any are pending,
   * which the right side says as `details 3/12`.
   */
  details?: DetailsCount;
  /** The instant ages and waits are measured at. */
  now: Date;
  /** The time zone a time of day is written in, such as `Europe/Paris`. */
  timezone: string;
  /** The short name of each watched repository, keyed by `owner/name`. */
  names: Readonly<Record<string, string>>;
  /** The width of the pane, in display cells. */
  width: number;
}
