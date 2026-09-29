import type { ReactNode } from "react";
import type { CacheStatus } from "../lib/cache/index.js";
import type { Problem } from "../lib/text/index.js";
import { tokens } from "../lib/tokens/index.js";
import { EmptyState, Notice, ProgressLine } from "../lib/ui/index.js";
import describeHold from "./describeHold.js";
import type { TerminalMode } from "./types.js";
import type { UseActivityResult } from "./useActivity.js";

/** What decides what stands in for the list. */
export interface StandInProps {
  readonly mode: TerminalMode;
  /** What keeps the screen from listing anything, such as a defect. */
  readonly problem: Problem | undefined;
  /** Why a key could not open an editor, given while no row is listed. */
  readonly refused: ReactNode;
  /** Whether the threads are in, or there is nothing to watch. */
  readonly held: boolean;
  readonly status: CacheStatus | undefined;
  /** The time zone the time the refresh resumes is written in. */
  readonly timezone: string;
  /** Whether owed is on screen with no group to list. */
  readonly nothingOwed: boolean;
  /** Why owed's rows may be wrong: a watched repository lists no team. */
  readonly teamless:
    | { readonly reason: string; readonly recovery: string }
    | undefined;
  /** Whether owed's list is drawn once nothing before it stands in. */
  readonly owedListed: boolean;
  readonly activity: UseActivityResult;
  /** The width of the pane, in display cells. */
  readonly width: number;
}

/** The indent of what stands in for the list, in display cells. */
const indent = 2;

/** Reads a sentence as a line on screen, which ends without a full stop. */
const dropFullStop = (sentence: string) => sentence.replace(/\.$/, "");

/**
 * What stands in for the list, in this order: the problem that keeps the
 * screen from listing anything; why a key could not open an editor, while
 * no row is listed; before the first data, why the fetch waits, or its
 * progress; nothing owed, under the notice while no team is listed; then,
 * unless owed's list is drawn, why activity's events could not be read,
 * or that they are being read for the window on screen. Nothing stands in
 * otherwise.
 */
export default function drawStandIn({
  mode,
  problem,
  refused,
  held,
  status,
  timezone,
  nothingOwed,
  teamless,
  owedListed,
  activity,
  width,
}: StandInProps): ReactNode {
  if (problem) {
    const { message, recovery } = problem;
    return (
      <Notice
        reason={dropFullStop(message)}
        recovery={recovery}
        width={width}
      />
    );
  }
  if (refused) return refused;
  if (!held) {
    const hold = status && describeHold(status, timezone);
    return hold ? (
      <Notice
        reason={dropFullStop(hold.reason)}
        recovery={hold.recovery}
        width={width}
      />
    ) : (
      <box flexDirection="column" paddingLeft={indent}>
        <text fg={tokens["color.text"]}>refresh in progress…</text>
        <ProgressLine
          fetched={status?.fullRefresh?.fetched ?? 0}
          total={status?.fullRefresh?.total ?? 0}
          width={width - indent}
        />
      </box>
    );
  }
  if (nothingOwed) {
    return (
      <box flexDirection="column">
        {teamless && <Notice {...teamless} width={width} />}
        <EmptyState message="nothing owed" width={width} />
      </box>
    );
  }
  if (owedListed) return undefined;
  if (activity && "problem" in activity) {
    const { message, recovery } = activity.problem;
    return (
      <Notice
        reason={dropFullStop(message)}
        recovery={recovery}
        width={width}
      />
    );
  }
  if (mode === "activity" && !activity) {
    // No list is held for the window yet: on opening, and after t.
    return (
      <box paddingLeft={indent}>
        <text fg={tokens["color.text"]}>refresh in progress…</text>
      </box>
    );
  }
  return undefined;
}
