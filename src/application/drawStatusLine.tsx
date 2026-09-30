import type { ReactNode } from "react";
import type { AttentionState, CacheStatus } from "../lib/cache/index.js";
import type { Repo } from "../lib/config/index.js";
import type { Budget } from "../lib/provider/index.js";
import type { Problem } from "../lib/text/index.js";
import { describeBudget } from "../lib/text/index.js";
import {
  type ActionResult,
  type DetailsCount,
  StatusLine,
} from "../lib/ui/index.js";

/** What decides what the status line says. */
export interface StatusLineState {
  /** What keeps the screen from listing anything, such as a defect. */
  readonly problem: Problem | undefined;
  readonly status: CacheStatus | undefined;
  /**
   * A failure outside the refresh that leaves the rows held, such as
   * reading activity's events or whom gh is signed in as.
   */
  readonly failure: CacheStatus["failure"];
  readonly action: ActionResult | undefined;
  readonly attention: AttentionState;
  /** How many of the details asked for are read, while any are pending. */
  readonly details: DetailsCount | undefined;
  /**
   * The queries' budget, whose live figures the right side says once less
   * than 40% of it is left.
   */
  readonly budget: Budget | undefined;
  readonly now: Date;
  /** The time zone a time of day is written in. */
  readonly timezone: string;
  readonly watched: readonly Pick<Repo, "repo" | "name">[];
  /** The width of the pane, in display cells. */
  readonly width: number;
}

/**
 * The status line under the list. A problem that keeps the screen from
 * listing anything stands in the list's place, so the line says nothing
 * of the cache then; a failure that leaves the rows held is named as a
 * failed refresh is.
 */
export default function drawStatusLine({
  problem,
  status,
  failure,
  action,
  attention,
  details,
  budget,
  now,
  timezone,
  watched,
  width,
}: StatusLineState): ReactNode {
  const shown = status && failure ? { ...status, failure } : status;
  return (
    <StatusLine
      status={problem ? undefined : shown}
      action={action}
      attention={attention}
      details={details}
      liveBudget={describeBudget(budget, now, timezone)}
      now={now}
      timezone={timezone}
      names={Object.fromEntries(watched.map(({ repo, name }) => [repo, name]))}
      width={width}
    />
  );
}
