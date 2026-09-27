import type { WorkingClock } from "../clock/index.js";
import type { Repo } from "../config/index.js";
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
export interface FieldList {
  readonly fit: "wrapped";
  readonly fields: readonly Field[];
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
  /** Whether the pull request sits in a stack, shown by the margin rule. */
  readonly stacked: boolean;
  /** `example#12`. */
  readonly reference: Field;
  /** `reply`, `review` or `close`. */
  readonly kind: Field;
  /** `1d over` or `9h left`. */
  readonly distance: Field;
  readonly title: Field;
  /** The one owner, or `unassigned`; absent when the owners take a line of their own. */
  readonly owner?: Field;
  /** `draft`, on a draft pull request. */
  readonly draft?: Field;
  /** Every owner, on a third line, when there are two or more. */
  readonly owners?: FieldList;
}

/** A section of the list; without a heading when the list is not grouped. */
export interface WaitGroup {
  readonly heading?: Field;
  readonly rows: readonly WaitRow[];
}

/** How many waits stand in each state. */
export interface Counts {
  readonly over: number;
  readonly soon: number;
  readonly onTrack: number;
}

/** Everything owed shows for one address. */
export interface OwedList {
  readonly address: OwedAddress;
  readonly groups: readonly WaitGroup[];
  readonly counts: Counts;
  /** `3 over · 2 soon · 6 on track`. */
  readonly summary: Field;
}
