import {
  addWorkingTime,
  type Duration,
  measureDuration,
} from "../clock/index.js";
import type { Settings } from "../config/index.js";
import { type Account, classify } from "../people/index.js";
import type { ThreadSummary } from "../waits/index.js";

/** The kinds of event a provider records on a thread. */
export type EventKind =
  | "opened"
  | "commented"
  | "reviewed"
  | "reviewRequested"
  | "pushed"
  | "assigned"
  | "labelled"
  | "closed"
  | "merged"
  | "reopened";

/** Something that happened on a thread, as the provider records it. */
export interface Event {
  readonly thread: ThreadSummary;
  readonly kind: EventKind;
  readonly actor: Account;
  readonly at: Date;
}

/** An event inside the window, marked when a bot made it. */
export interface WindowEvent extends Event {
  readonly bot: boolean;
}

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
 * @param settings The settings in effect for the events' repository.
 */
export default function selectEvents(
  events: readonly Event[],
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
