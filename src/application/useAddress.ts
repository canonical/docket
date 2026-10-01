import { useState } from "react";
import {
  type ActivityGrouping,
  activityGroupings,
} from "../lib/activity/index.js";
import type { Duration } from "../lib/clock/index.js";
import {
  type FinishedGrouping,
  finishedGroupings,
} from "../lib/finished/index.js";
import { type OwedGrouping, owedGroupings } from "../lib/owed/index.js";
import { terminalModes } from "./constants.js";
import type { TerminalMode, TerminalView } from "./types.js";

/** Props for the useAddress hook: where the screen opens. */
export interface UseAddressProps
  extends Pick<
    TerminalView,
    "mode" | "owedGrouping" | "activity" | "finished"
  > {
  /** The windows `t` steps through, the first the default. */
  readonly windows: readonly Duration[];
  /** Whether the provider relates pull requests in stacks to group by. */
  readonly stacks: boolean;
}

/** Result of the useAddress hook: where the screen is, and how to move. */
export interface UseAddressResult {
  readonly mode: TerminalMode;
  /** Shows `mode`, at the grouping and window it was left on. */
  readonly setMode: (mode: TerminalMode) => void;
  /**
   * Shows the mode before the one on screen, or after it, in the order
   * owed, activity, finished; at either end it stays.
   */
  readonly stepMode: (direction: -1 | 1) => void;
  readonly owedGrouping: OwedGrouping;
  readonly activityGrouping: ActivityGrouping;
  /** activity's window. */
  readonly window: Duration;
  readonly finishedGrouping: FinishedGrouping;
  /** finished's window, kept apart from activity's. */
  readonly finishedWindow: Duration;
  /** Steps the mode on screen to its next grouping, after the last the first. */
  readonly nextGrouping: () => void;
  /** Steps the mode on screen to its next window, after the last the first. */
  readonly nextWindow: () => void;
  /** The mode, its address and its sort, as the header names them. */
  readonly header: {
    readonly title: TerminalMode;
    /** `one list` or `by owner`, after the window where the mode has one, `24h · by kind`. */
    readonly address: string;
    /** The mode's fixed order: `overdue first`, `newest first`. */
    readonly sort: string;
  };
}

/** The entry after `item` in `list`, and the first after the last. */
function cycle<T>(list: readonly T[], item: T): T {
  const [next] = [...list.slice(list.indexOf(item) + 1), ...list];
  return next;
}

/** The ungrouped list's name, where the address has no grouping. */
const nameGrouping = (grouping: string) =>
  grouping === "none" ? "one list" : `by ${grouping}`;

/** A window and a grouping, as the header reads them: `24h · by kind`. */
const nameWindow = ({ amount, unit }: Duration, grouping: string) =>
  `${amount}${unit} · ${nameGrouping(grouping)}`;

/**
 * Where the screen is: the mode, and each mode's own address, the
 * grouping each keeps and the window activity and finished each keep,
 * with the keys' steps through them, and the header's words for it: the
 * address read like the text address, the ungrouped list named `one
 * list`, and the mode's fixed sort. They are the terminal's own; text
 * mode's title stays its own. Without the stack relation there is nothing
 * to group by stack, so `by stack` leaves owed's groupings, and a call
 * naming it opens on the first.
 */
export default function useAddress({
  mode: openingMode,
  owedGrouping: openingGrouping,
  activity: openingActivity,
  finished: openingFinished,
  windows,
  stacks,
}: UseAddressProps): UseAddressResult {
  const owedChoices = owedGroupings.filter(
    (grouping) => grouping !== "stack" || stacks,
  );
  const [firstOwed] = owedChoices;
  const [firstActivity] = activityGroupings;
  const [firstFinished] = finishedGroupings;
  const [firstWindow] = windows;
  const [mode, setMode] = useState<TerminalMode>(openingMode);
  const [owedGrouping, setOwedGrouping] = useState(
    owedChoices.includes(openingGrouping) ? openingGrouping : firstOwed,
  );
  const [activityGrouping, setActivityGrouping] = useState(
    openingActivity?.grouping ?? firstActivity,
  );
  const [window, setWindow] = useState(openingActivity?.window ?? firstWindow);
  const [finishedGrouping, setFinishedGrouping] = useState(
    openingFinished?.grouping ?? firstFinished,
  );
  const [finishedWindow, setFinishedWindow] = useState(
    openingFinished?.window ?? firstWindow,
  );
  const header = {
    owed: { address: nameGrouping(owedGrouping), sort: "overdue first" },
    activity: {
      address: nameWindow(window, activityGrouping),
      sort: "newest first",
    },
    finished: {
      address: nameWindow(finishedWindow, finishedGrouping),
      sort: "newest first",
    },
  }[mode];
  return {
    mode,
    setMode,
    stepMode: (direction) =>
      setMode((current) => {
        const place = terminalModes.indexOf(current) + direction;
        return terminalModes[place] ?? current;
      }),
    owedGrouping,
    activityGrouping,
    window,
    finishedGrouping,
    finishedWindow,
    nextGrouping: () => {
      if (mode === "owed") {
        setOwedGrouping((current) => cycle(owedChoices, current));
      } else if (mode === "activity") {
        setActivityGrouping((current) => cycle(activityGroupings, current));
      } else {
        setFinishedGrouping((current) => cycle(finishedGroupings, current));
      }
    },
    nextWindow: () =>
      (mode === "finished" ? setFinishedWindow : setWindow)((current) =>
        cycle(windows, current),
      ),
    header: { title: mode, ...header },
  };
}
