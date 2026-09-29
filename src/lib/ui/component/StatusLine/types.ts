import type { AttentionState, CacheStatus } from "../../../cache/index.js";

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
}

/** The result of something the user did, such as opening a thread. */
export interface ActionResult {
  /** Whether it failed: the line then marks it `✗`, else `✓`. */
  readonly failed: boolean;
  /** What happened, in plain words, such as `could not open the browser`. */
  readonly text: string;
  /** When it happened: the line shows it for 5 seconds from then. */
  readonly at: Date;
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
   * right side of an active pane then says, as it does while the refresh
   * is paused.
   */
  detailsPaused?: boolean;
  /** The instant ages and waits are measured at. */
  now: Date;
  /** The time zone a time of day is written in, such as `Europe/Paris`. */
  timezone: string;
  /** The short name of each watched repository, keyed by `owner/name`. */
  names: Readonly<Record<string, string>>;
  /** The width of the pane, in display cells. */
  width: number;
}
