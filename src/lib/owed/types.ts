import type { WorkingClock } from "../clock/index.js";
import type { People, Repo } from "../config/index.js";
import type { Wait } from "../waits/index.js";

/**
 * How a face fits a field to the pane: trimmed text takes one line and is
 * cut with `…`, wrapped text flows over as many lines as it needs.
 */
export type Fit = "trimmed" | "wrapped";

/**
 * One piece of text a face draws, whole. The view model never cuts text
 * and caps no field, because only a face knows its width and measures
 * display cells: a face that trims decides how much room each slot gets.
 */
export interface Field {
  readonly text: string;
  readonly fit: Fit;
}

/** Fields that share a line and wrap between each other. */
export interface FieldList<F extends Field = Field> {
  readonly fit: "wrapped";
  readonly fields: readonly F[];
}

/**
 * Whom a login is, as a list tells people apart: `you`, the account gh
 * is signed in with, or a GitHub team it belongs to; otherwise the group
 * the settings put the account in, `team`, `internal`, `outside` (the
 * settings' `external`) or `bot`. Five groups, in that order, each a
 * face draws one way.
 */
export type PersonGroup = "you" | "team" | "internal" | "outside" | "bot";

/** A login a list names, or a team the viewer belongs to, with its group. */
export interface Person extends Field {
  readonly group: PersonGroup;
}

/**
 * Who owns a wait or a thread: a person, or a text that names no login,
 * such as `unassigned` or a GitHub team the viewer is not known to be in.
 */
export type Owner = Person | Field;

/**
 * A pane's header: the mode as its title, and where the reader is inside
 * it as its address, absent when there is nothing to add to the mode.
 */
export interface Header {
  readonly title: Field;
  readonly address?: Field;
}

/** Where a wait stands against its target. */
export type WaitState = "over" | "soon" | "onTrack";

/** How owed splits its list into sections. */
export type OwedGrouping = "none" | "owner" | "repo" | "stack";

/** Where the reader is in owed: the mode and its grouping. */
export interface OwedAddress {
  readonly mode: "owed";
  readonly grouping: OwedGrouping;
}

/** A watched repository and the waits running on its threads. */
export interface RepoWaits {
  /** The repository, with the short name its references use. */
  readonly repo: Repo;
  /** The working clock of the repository's settings. */
  readonly time: WorkingClock;
  readonly waits: readonly Wait[];
  /**
   * Each login's group in the repository, as `gatherPeople` gives it
   * from the settings and the threads.
   */
  readonly people: People;
  /**
   * Whether the repository's own file is invalid, so its settings are the
   * built-in defaults.
   */
  readonly invalidFile?: boolean;
}

/** One running wait, as the list shows it. */
export interface WaitRow {
  readonly wait: Wait;
  /** The short name of the wait's repository. */
  readonly repo: string;
  readonly state: WaitState;
  /**
   * How far past its due time the wait is, as a share of its target:
   * positive once over, negative while time is left. Rows sort on it.
   */
  readonly overdue: number;
  /**
   * The target's length in working hours, on the clock of the wait's
   * repository: a working week is 24 hours for each workday, so `1w` is
   * 120 hours on a Monday-to-Friday clock and 144 on a six-day one.
   */
  readonly targetHours: number;
  /** Whether the pull request sits in a stack, shown by the margin rule. */
  readonly stacked: boolean;
  /** `example#12`. */
  readonly reference: Field;
  /** `reply`, `review` or `close`. */
  readonly kind: Field;
  /** `1d over` or `9h left`. */
  readonly distance: Field;
  readonly title: Field;
  /** Who waits on the move: the wait's author. */
  readonly author: Person;
  /** The one owner, or `unassigned`; absent when the owners take a line of their own. */
  readonly owner?: Owner;
  /** `draft`, on a draft pull request. */
  readonly draft?: Field;
  /** Every owner, on a third line, when there are two or more. */
  readonly owners?: FieldList<Owner>;
  /** `invalid repository file`, when the repository's own file is invalid. */
  readonly invalidFile?: Field;
}

/**
 * A section of the list; without a heading when the list is not grouped.
 * An owner's section is headed by the owner, a person with their group.
 */
export interface WaitGroup {
  readonly heading?: Owner;
  readonly rows: readonly WaitRow[];
}

/** How many waits stand in each state. */
export interface Counts {
  readonly over: number;
  readonly soon: number;
  readonly onTrack: number;
}

/** Every running wait, measured and sorted for one instant. */
export interface WaitList {
  /** The rows, most overdue first. */
  readonly rows: readonly WaitRow[];
  readonly counts: Counts;
  /** `3 over · 2 soon · 6 on track`. */
  readonly summary: Field;
}

/** Everything owed shows for one address. */
export interface OwedList {
  readonly address: OwedAddress;
  readonly groups: readonly WaitGroup[];
  readonly counts: Counts;
  /** `3 over · 2 soon · 6 on track`. */
  readonly summary: Field;
}
