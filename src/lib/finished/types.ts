import type { Duration } from "../clock/index.js";
import type { People, Repo, Settings } from "../config/index.js";
import type {
  Aggregate,
  Coverage,
  FinishedThread,
  MeasureKind,
  Measures,
  Verdict,
} from "../endings/index.js";
import type { Field, FieldList, Owner, Person } from "../owed/index.js";

/** How finished splits its list into sections. */
export type FinishedGrouping = "kind" | "ending" | "repo" | "none";

/** Where the reader is in finished: the mode, its window and its grouping. */
export interface FinishedAddress {
  readonly mode: "finished";
  /** How far back the list reaches, in working time. */
  readonly window: Duration;
  readonly grouping: FinishedGrouping;
}

/** A watched repository and the threads that finished within the window. */
export interface RepoEndings {
  /** The repository, with the short name its references use. */
  readonly repo: Repo;
  /**
   * Each login's group in the repository, as `gatherPeople` gives it
   * from the settings and the threads.
   */
  readonly people: People;
  /** The settings in effect for the repository, which measure its threads. */
  readonly settings: Settings;
  readonly finished: readonly FinishedThread[];
  /**
   * Whether the repository's own file is invalid, so its settings are the
   * built-in defaults.
   */
  readonly invalidFile?: boolean;
}

/** A thread's ending as its one event line: who ended it, how, and how long ago. */
export interface EndingLine {
  /** `alice closed as completed`. */
  readonly text: Field;
  /** Who ended it, with their group, where the provider records someone. */
  readonly actor?: Person;
  /** The ending in the provider's words: the text after the actor. */
  readonly action: Field;
  /** How long ago it ended: `25m`, `3h` or `1d`. */
  readonly age: Field;
}

/** A finished thread as the list shows it: an activity row whose event is its ending. */
export interface FinishedRow {
  readonly thread: FinishedThread;
  /** The short name of the thread's repository. */
  readonly repo: string;
  /** Whether the pull request sits in a stack, shown by the margin's mark. */
  readonly stacked: boolean;
  /** `example#12`. */
  readonly reference: Field;
  /** `issue` or `PR`. */
  readonly kind: Field;
  /**
   * The verdict as a duration, `4d over` past the target or `open 3d`
   * within it; the ending's age, such as `2d`, when a label exempts the
   * thread. Owed's and activity's rows name the same slot their distance.
   */
  readonly distance: Field;
  readonly title: Field;
  /** Who opened the thread. */
  readonly author: Person;
  /** The one owner, or `unassigned`; absent when the owners take a line. */
  readonly owner?: Owner;
  /** Every owner, on a third line, when there are two or more. */
  readonly owners?: FieldList<Owner>;
  /** `draft`, on a pull request that ended as a draft. */
  readonly draft?: Field;
  /** The row's one event line. */
  readonly ending: EndingLine;
  /**
   * The pull request that closed it, where the provider records one:
   * `example#1200`, by the short name of a watched repository, else by
   * its `owner/name`.
   */
  readonly closer?: Field;
  /** How long the thread was open, in working time: `open 9d`. */
  readonly open: Field;
  /** Time to close's target, `target 5d`; absent when a label exempts the thread. */
  readonly target?: Field;
  /**
   * The same target in working hours, which a program reads: a week's
   * length depends on the workdays of the repository's clock.
   */
  readonly targetHours?: number;
  /** How far past its target it closed, `4d over`; absent within it. */
  readonly over?: Field;
  /** Time to close's verdict; absent when a label exempts the thread. */
  readonly verdict?: Verdict;
  readonly measures: Measures;
  /** `invalid repository file`, when the repository's own file is invalid. */
  readonly invalidFile?: Field;
}

/**
 * What the list counts: the outcome `merged`, every other outcome as
 * `closed`, and the threads whose time to close ended past its target,
 * with the same counts split by kind of thread and outcome.
 */
export interface FinishedCounts {
  readonly merged: number;
  readonly closed: number;
  /** Over the threads time to close is measured on. */
  readonly over: Aggregate<number>;
  readonly byKind: {
    readonly issue: {
      readonly completed: number;
      readonly notPlanned: number;
      readonly duplicate: number;
      /** Closed with no reason recorded. */
      readonly closed: number;
    };
    readonly pullRequest: { readonly merged: number; readonly closed: number };
  };
}

/** Every thread that finished within the window, gathered for one instant. */
export interface EndingList {
  /** The rows, by their ending, newest first. */
  readonly rows: readonly FinishedRow[];
  readonly counts: FinishedCounts;
  /** How each measure stands across the rows. */
  readonly measures: { readonly [Kind in MeasureKind]: Coverage };
  /** `4 merged · 3 closed · 3 over`. */
  readonly summary: Field;
}

/** A section of the list; without a heading when the list is not grouped. */
export interface FinishedGroup {
  readonly heading?: Field;
  readonly rows: readonly FinishedRow[];
}

/** Everything finished shows for one address. */
export interface FinishedList extends Omit<EndingList, "rows"> {
  readonly address: FinishedAddress;
  readonly groups: readonly FinishedGroup[];
  /** `nothing merged or closed in 24h`, when the window holds no thread. */
  readonly empty?: Field;
}
