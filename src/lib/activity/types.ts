import type { Duration } from "../clock/index.js";
import type { People, Repo } from "../config/index.js";
import type { WindowEvent } from "../events/index.js";
import type { Thread, ThreadSummary } from "../waits/index.js";

/**
 * How a face fits a field to the pane: trimmed text takes one line and is
 * cut with `…`, wrapped text flows over as many lines as it needs.
 */
export type Fit = "trimmed" | "wrapped";

/**
 * One piece of text a face draws. The view model never cuts text to a
 * width, because only a face knows its width and measures display cells.
 */
export interface Field {
  readonly text: string;
  readonly fit: Fit;
  /** The most display cells the field takes, whatever the width. */
  readonly cells?: number;
}

/** Fields that share a line and wrap between each other. */
export interface FieldList {
  readonly fit: "wrapped";
  readonly fields: readonly Field[];
}

/** How activity splits its list into sections. */
export type ActivityGrouping = "none";

/** Where the reader is in activity: the mode, its window and its grouping. */
export interface ActivityAddress {
  readonly mode: "activity";
  /** How far back the list reaches, in working time. */
  readonly window: Duration;
  readonly grouping: ActivityGrouping;
}

/** A watched repository, the events inside the window, and its threads. */
export interface RepoEvents {
  /** The repository, with the short name its references use. */
  readonly repo: Repo;
  /** The people of the repository's settings, which tell bots apart. */
  readonly people: People;
  /**
   * The threads' recorded facts, which give a row its owners and its
   * draft state. An event whose thread is not among them still has a row,
   * with no owner.
   */
  readonly threads: readonly Thread[];
  readonly events: readonly WindowEvent[];
}

/** One event under its thread: who did what, and how long ago. */
export interface EventLine {
  /** The event, which says whether a bot made it. */
  readonly event: WindowEvent;
  /** `alice pushed 2 commits`. */
  readonly text: Field;
  /** `25m`, `3h` or `1d`. */
  readonly age: Field;
}

/** A thread with events inside the window, as the list shows it. */
export interface ThreadRow {
  readonly thread: ThreadSummary;
  /** The short name of the thread's repository. */
  readonly repo: string;
  /** Whether the pull request sits in a stack, shown by the margin rule. */
  readonly stacked: boolean;
  /** `example#12`. */
  readonly reference: Field;
  /** `issue`, `PR` or `discussion`. */
  readonly kind: Field;
  /** The age of the newest event. */
  readonly age: Field;
  readonly title: Field;
  /**
   * The one owner, or `unassigned`. Absent when the owners take a line of
   * their own, or when the thread's facts were not given.
   */
  readonly owner?: Field;
  /** `draft`, on a draft pull request. */
  readonly draft?: Field;
  /** Every owner, on a third line, when there are two or more. */
  readonly owners?: FieldList;
  /** The thread's events, newest first. */
  readonly events: readonly EventLine[];
}

/** A section of the list; without a heading when the list is not grouped. */
export interface ThreadGroup {
  readonly heading?: Field;
  readonly rows: readonly ThreadRow[];
}

/** Everything activity shows for one address. */
export interface ActivityList {
  readonly address: ActivityAddress;
  readonly groups: readonly ThreadGroup[];
  readonly counts: { readonly threads: number; readonly events: number };
  /** `7 threads · 10 events`. */
  readonly summary: Field;
}
