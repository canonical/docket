import {
  addWorkingTime,
  type Duration,
  measureDuration,
} from "../clock/index.js";
import type { Settings } from "../config/index.js";
import { type Account, classify } from "../people/index.js";
import type { ThreadSummary } from "../waits/index.js";

/** What every event records: where it happened, who made it, and when. */
interface EventFacts {
  readonly thread: ThreadSummary;
  readonly actor: Account;
  readonly at: Date;
}

/**
 * Something that happened on a thread, as the provider records it. A kind
 * whose activity line names more than its actor carries that detail.
 */
export type ThreadEvent = EventFacts &
  (
    | {
        readonly kind:
          | "opened"
          | "commented"
          | "reviewed"
          | "reviewRequested"
          | "closed"
          | "merged"
          | "reopened";
      }
    | {
        readonly kind: "assigned";
        /** The login of the account assigned. */
        readonly assignee: string;
      }
    | {
        readonly kind: "labelled";
        /** The label's name, such as `kind=bug`. */
        readonly label: string;
      }
    | {
        readonly kind: "pushed";
        /**
         * How many commits the push carried. Absent when the provider
         * cannot count them, such as after a force push.
         */
        readonly commits?: number;
      }
    | {
        /** The checks on the pull request's head commit failed. */
        readonly kind: "checksFailed";
        /** The names of the checks that failed, such as `lint`. */
        readonly checks: readonly string[];
      }
  );

/** The kinds of event a provider records on a thread. */
export type EventKind = ThreadEvent["kind"];

/** An event inside the window, marked when a bot made it. */
export type WindowEvent = ThreadEvent & { readonly bot: boolean };

/** An event marked when a bot made it, and the last instant it is inside a window. */
export interface TimedEvent {
  readonly event: WindowEvent;
  /** Adding the window to the event: it is inside the window until then. */
  readonly until: Date;
}

/**
 * Times each event against `window` of working time, in the order given,
 * so that which events are inside it at any instant is one comparison
 * each: an event is inside the window at `now` while its `until` is `now`
 * or later. Every kind of event is timed, whoever made it, the reader's
 * own included, and events by bots are marked rather than dropped.
 *
 * Adding the window counts only workdays: on a Monday-to-Friday clock, a
 * 24-hour window on Monday morning reaches back to Friday morning,
 * weekend included.
 *
 * An event dated after `now` is inside the window. Its date comes from
 * GitHub's clock, which decides what is fresh, never the reader's: a
 * reader whose clock runs behind GitHub's still sees the latest events,
 * their own included.
 *
 * @param settings The settings in effect for the events' repository.
 */
export default function timeEvents(
  events: readonly ThreadEvent[],
  window: Duration,
  settings: Settings,
): TimedEvent[] {
  const { time, people } = settings;
  const length = measureDuration(window, time);
  return events.map((event) => ({
    event: { ...event, bot: classify(event.actor, people) === "bot" },
    until: addWorkingTime(event.at, length, time),
  }));
}
