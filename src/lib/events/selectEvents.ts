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
        /** How many commits the push carried. */
        readonly commits: number;
      }
  );

/** The kinds of event a provider records on a thread. */
export type EventKind = ThreadEvent["kind"];

/** An event inside the window, marked when a bot made it. */
export type WindowEvent = ThreadEvent & { readonly bot: boolean };

/**
 * Keeps the events that happened within `window` of working time before
 * `now`, in the order given. Every kind of event is kept, whoever made it,
 * the reader's own included, and events by bots are marked rather than
 * dropped.
 *
 * An event is inside the window while adding the window to it reaches
 * `now` or later, so the time between counts only workdays: on a
 * Monday-to-Friday clock, a 24-hour window on Monday morning reaches back
 * to Friday morning, weekend included.
 *
 * An event dated after `now` is kept. Its date comes from GitHub's clock,
 * which decides what is fresh, never the reader's: a reader whose clock
 * runs behind GitHub's still sees the latest events, their own included.
 *
 * @param settings The settings in effect for the events' repository.
 */
export default function selectEvents(
  events: readonly ThreadEvent[],
  window: Duration,
  now: Date,
  settings: Settings,
): WindowEvent[] {
  const { time, people } = settings;
  const length = measureDuration(window, time);
  return events
    .filter((event) => addWorkingTime(event.at, length, time) >= now)
    .map((event) => ({
      ...event,
      bot: classify(event.actor, people) === "bot",
    }));
}
