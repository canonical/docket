import type { Duration } from "../clock/index.js";
import type { People, Repo } from "../config/index.js";
import type { WindowEvent } from "../events/index.js";
import type { Field, FieldList, Owner, Person } from "../owed/index.js";
import type { Thread, ThreadSummary } from "../waits/index.js";

/** How activity splits its list into sections. */
export type ActivityGrouping = "kind" | "repo" | "none";

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
  /**
   * Each login's group in the repository, as `gatherPeople` gives it
   * from the settings and the threads, which tells bots apart.
   */
  readonly people: People;
  /**
   * The threads' recorded facts, which give a row its owners and its
   * draft state. An event whose thread is not among them still has a row,
   * with no owner.
   */
  readonly threads: readonly Thread[];
  readonly events: readonly WindowEvent[];
  /**
   * Whether the repository's own file is invalid, so its settings are the
   * built-in defaults.
   */
  readonly invalidFile?: boolean;
}

/** One event under its thread: who did what, and how long ago. */
export interface EventLine {
  /** The event, which says whether a bot made it. */
  readonly event: WindowEvent;
  /** `alice pushed 2 commits`. */
  readonly text: Field;
  /**
   * Who did it, with their group, which a face marks: absent for failed
   * checks, which name the checks rather than who ran them.
   */
  readonly actor?: Person;
  /** What they did, `pushed 2 commits`: the text after the actor. */
  readonly action: Field;
  /**
   * What the action acted on, as GitHub writes it, which the action's
   * text holds at its end or, for failed checks, in its brackets: the
   * label, the person assigned, or the checks' names. Absent when the
   * action names nothing written on GitHub, as a push does.
   */
  readonly target?: Field;
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
  /**
   * The age of the newest event, such as `25m`. Owed's rows name the same
   * slot their distance, so one row shape serves both lists.
   */
  readonly distance: Field;
  readonly title: Field;
  /** Who opened the thread, when its facts were given. */
  readonly author?: Person;
  /**
   * The one owner, or `unassigned`. Absent when the owners take a line of
   * their own, or when the thread's facts were not given.
   */
  readonly owner?: Owner;
  /** `draft`, on a draft pull request. */
  readonly draft?: Field;
  /** Every owner, on a third line, when there are two or more. */
  readonly owners?: FieldList<Owner>;
  /** The thread's events, newest first. */
  readonly events: readonly EventLine[];
  /** `invalid repository file`, when the repository's own file is invalid. */
  readonly invalidFile?: Field;
}

/** A section of the list; without a heading when the list is not grouped. */
export interface ThreadGroup {
  readonly heading?: Field;
  readonly rows: readonly ThreadRow[];
}

/** Every thread with events inside the window, gathered for one instant. */
export interface EventList {
  /** The rows, by their newest event, newest first. */
  readonly rows: readonly ThreadRow[];
  readonly counts: { readonly threads: number; readonly events: number };
  /** `7 threads`, `10 events`. */
  readonly summary: FieldList;
}

/** Everything activity shows for one address. */
export interface ActivityList {
  readonly address: ActivityAddress;
  readonly groups: readonly ThreadGroup[];
  readonly counts: EventList["counts"];
  /** `7 threads`, `10 events`. */
  readonly summary: FieldList;
}
