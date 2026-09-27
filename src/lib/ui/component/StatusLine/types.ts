import type { CacheStatus } from "../../../cache/index.js";

/**
 * What the status line says, and what kind of message it is: the kind
 * decides its colour, and ranks it against the others.
 */
export interface StatusMessage {
  readonly kind: "error" | "progress" | "refreshing" | "notice" | "freshness";
  readonly text: string;
}

/** Props for the StatusLine component. */
export interface StatusLineProps {
  /**
   * The cache's state, or none while docket has no cache: the line is
   * then blank.
   */
  status?: CacheStatus;
  /** The instant ages and waits are measured at. */
  now: Date;
  /** The time zone a time of day is written in, such as `Europe/Paris`. */
  timezone: string;
  /** The short name of each watched repository, keyed by `owner/name`. */
  names: Readonly<Record<string, string>>;
  /** The width of the pane, in display cells. */
  width: number;
}
