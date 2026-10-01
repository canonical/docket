import { useState } from "react";
import {
  type ActivityGrouping,
  activityGroupings,
} from "../lib/activity/index.js";
import type { Duration } from "../lib/clock/index.js";
import { type OwedGrouping, owedGroupings } from "../lib/owed/index.js";
import type { TerminalMode, TerminalView } from "./types.js";

/** Props for the useAddress hook: where the screen opens. */
export interface UseAddressProps
  extends Pick<TerminalView, "mode" | "owedGrouping" | "activity"> {
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
  readonly owedGrouping: OwedGrouping;
  readonly activityGrouping: ActivityGrouping;
  readonly window: Duration;
  /** Steps the mode on screen to its next grouping, after the last the first. */
  readonly nextGrouping: () => void;
  /** Steps activity to its next window, after the last the first. */
  readonly nextWindow: () => void;
  /** The mode, its address and its sort, as the header names them. */
  readonly header: {
    readonly title: TerminalMode;
    /** `one list` or `by owner`, in activity after the window, `24h · by kind`. */
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
const nameGrouping = (grouping: OwedGrouping | ActivityGrouping) =>
  grouping === "none" ? "one list" : `by ${grouping}`;

/**
 * Where the screen is: the mode, and each mode's own address, the
 * grouping owed and activity each keep and activity's window, with the
 * keys' steps through them, and the header's words for it: the address
 * read like the text address, the ungrouped list named `one list`, and
 * the mode's fixed sort. They are the terminal's own; text mode's title
 * stays its own. Without the stack relation there is nothing
 * to group by stack, so `by stack` leaves owed's groupings, and a call
 * naming it opens on the first.
 */
export default function useAddress({
  mode: openingMode,
  owedGrouping: openingGrouping,
  activity: openingActivity,
  windows,
  stacks,
}: UseAddressProps): UseAddressResult {
  const owedChoices = owedGroupings.filter(
    (grouping) => grouping !== "stack" || stacks,
  );
  const [firstOwed] = owedChoices;
  const [firstActivity] = activityGroupings;
  const [firstWindow] = windows;
  const [mode, setMode] = useState<TerminalMode>(openingMode);
  const [owedGrouping, setOwedGrouping] = useState(
    owedChoices.includes(openingGrouping) ? openingGrouping : firstOwed,
  );
  const [activityGrouping, setActivityGrouping] = useState(
    openingActivity?.grouping ?? firstActivity,
  );
  const [window, setWindow] = useState(openingActivity?.window ?? firstWindow);
  return {
    mode,
    setMode,
    owedGrouping,
    activityGrouping,
    window,
    nextGrouping: () =>
      mode === "owed"
        ? setOwedGrouping((current) => cycle(owedChoices, current))
        : setActivityGrouping((current) => cycle(activityGroupings, current)),
    nextWindow: () => setWindow((current) => cycle(windows, current)),
    header:
      mode === "owed"
        ? {
            title: mode,
            address: nameGrouping(owedGrouping),
            sort: "overdue first",
          }
        : {
            title: mode,
            address: `${window.amount}${window.unit} · ${nameGrouping(activityGrouping)}`,
            sort: "newest first",
          },
  };
}
