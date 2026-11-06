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
import {
  type InboxFilter,
  type InboxGrouping,
  inboxGroupings,
} from "../lib/inbox/index.js";
import { type OwedGrouping, owedGroupings } from "../lib/owed/index.js";
import { terminalModes } from "./constants.js";
import type { TerminalMode, TerminalView } from "./types.js";

/** Props for the useAddress hook: where the screen opens. */
export interface UseAddressProps
  extends Pick<
    TerminalView,
    "mode" | "owedGrouping" | "activity" | "finished" | "inbox"
  > {
  /** The windows `t` steps through, the first the default. */
  readonly windows: readonly Duration[];
  /** Whether the provider relates pull requests in stacks to group by. */
  readonly stacks: boolean;
}

/** Result of the useAddress hook: where the screen is, and how to move. */
export interface UseAddressResult {
  readonly mode: TerminalMode;
  /**
   * Shows the mode before the one on screen, or after it, in the order
   * owed, activity, finished, at the grouping and window it was left on;
   * at either end it stays.
   */
  readonly stepMode: (direction: -1 | 1) => void;
  readonly owedGrouping: OwedGrouping;
  readonly activityGrouping: ActivityGrouping;
  /** activity's window. */
  readonly window: Duration;
  readonly finishedGrouping: FinishedGrouping;
  /** finished's window, kept apart from activity's. */
  readonly finishedWindow: Duration;
  readonly inboxGrouping: InboxGrouping;
  readonly inboxFilter: InboxFilter;
  /** Shows the whole inbox, or only its unread notifications. */
  readonly toggleInboxFilter: () => void;
  /** Opens the inbox, or returns to owed when it is already open. */
  readonly toggleInbox: () => void;
  /** Steps the mode on screen to its next grouping, after the last the first. */
  readonly nextGrouping: () => void;
  /** Steps the mode on screen to its next window, after the last the first. */
  readonly nextWindow: () => void;
  /** The mode, its address and its sort, as the header names them. */
  readonly header: {
    readonly title: TerminalMode;
    /** `one list` or `by owner`, after the window where the mode has one, `24h · by kind`. */
    readonly address: string;
    /** The mode's fixed order: `overdue first`, `newest first`, `unread first`. */
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
  inbox: openingInbox,
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
  const [firstInbox] = inboxGroupings;
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
  const [inboxGrouping, setInboxGrouping] = useState(
    openingInbox?.grouping ?? firstInbox,
  );
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>(
    openingInbox?.filter ?? "unread",
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
    inbox: {
      address: `${inboxFilter} · ${nameGrouping(inboxGrouping)}`,
      sort: "unread first",
    },
  }[mode];
  return {
    mode,
    stepMode: (direction) =>
      setMode((current) => {
        const place = terminalModes.indexOf(current) + direction;
        // Neither end wraps, so a step past either stays where it is.
        if (place < 0 || place >= terminalModes.length) return current;
        return terminalModes[place];
      }),
    owedGrouping,
    activityGrouping,
    window,
    finishedGrouping,
    finishedWindow,
    inboxGrouping,
    inboxFilter,
    toggleInboxFilter: () =>
      setInboxFilter((current) => (current === "unread" ? "all" : "unread")),
    toggleInbox: () =>
      setMode((current) => (current === "inbox" ? "owed" : "inbox")),
    nextGrouping: () => {
      if (mode === "owed") {
        setOwedGrouping((current) => cycle(owedChoices, current));
      } else if (mode === "activity") {
        setActivityGrouping((current) => cycle(activityGroupings, current));
      } else if (mode === "finished") {
        setFinishedGrouping((current) => cycle(finishedGroupings, current));
      } else {
        setInboxGrouping((current) => cycle(inboxGroupings, current));
      }
    },
    nextWindow: () =>
      (mode === "finished" ? setFinishedWindow : setWindow)((current) =>
        cycle(windows, current),
      ),
    header: { title: mode, ...header },
  };
}
