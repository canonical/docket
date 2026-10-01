import type { WorkingClock } from "../clock/index.js";
import type { People, Repo } from "../config/index.js";
import type { Wait } from "../waits/index.js";

/**
 * What a field's text is, which decides how a face fits it to a slot too
 * narrow for it: an `identifier`, such as `example#12` or a branch, whose
 * end carries its meaning; a `person`, a login or a team's name; a
 * thread's `title`; a `quote` of what someone wrote on GitHub; docket's
 * own `words`, such as `review` or `unassigned`; a failure's `reason` and
 * its `recovery`; and a `figure`, such as `1d over` or `25m`.
 */
export type FieldKind =
  | "identifier"
  | "person"
  | "title"
  | "quote"
  | "words"
  | "reason"
  | "recovery"
  | "figure";

/**
 * One piece of text a face draws, whole, with the kind of text it is. The
 * view model never cuts text and caps no field, because only a face knows
 * its width and measures display cells: a face fits each field to its
 * slot by the field's kind.
 */
export interface Field {
  readonly text: string;
  readonly kind: FieldKind;
}

/** Fields that share a line, which a face wraps between each other. */
export interface FieldList<F extends Field = Field> {
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
  readonly kind: "person";
  readonly group: PersonGroup;
}

/**
 * Who owns a wait or a thread: a person, or a text that names no login,
 * such as `unassigned` or a GitHub team the viewer is not known to be in.
 */
export type Owner = Person | Field;

/**
 * A stack's section heading, as its parts: `nameHeading` words it,
 * `example stack 3 · 3 PRs → main`, and a face fits it as it fits a
 * stack's place: the repository's short name leaves whole first, then the
 * base branch is cut once in its middle, and `stack 3 · 3 PRs →` stays
 * whole.
 */
export interface StackHeading {
  readonly kind: "stack";
  /** The repository's short name: `example`. */
  readonly repo: string;
  /** The stack's number, its first pull request's: `3`. */
  readonly number: number;
  /** How many pull requests the stack holds, open or not. */
  readonly size: number;
  /** The branch the stack's first pull request merges into: `main`. */
  readonly base: string;
}

/** A section's heading: an owner, a stack, or docket's own name for it. */
export type Heading = Owner | StackHeading;

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
export type OwedGrouping = "none" | "owner" | "kind" | "repo" | "stack";

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
  /** The teams the personal file names as the viewer's. */
  readonly yours: readonly string[];
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
  /** `PR`, `issue` or `discussion`. */
  readonly threadKind: Field;
  /** `reply`, `review` or `close`. */
  readonly kind: Field;
  /** `1d over` or `9h left`. */
  readonly distance: Field;
  readonly title: Field;
  /** Who waits on the move: the wait's author. */
  readonly author: Person;
  /**
   * Who asked for the review, on a review wait: the request to the wait's
   * first owner, or else the latest request. Absent when GitHub does not
   * record who asked.
   */
  readonly requester?: Person;
  /**
   * Who acted on the thread last: whoever wrote its latest message, a
   * comment or a review, or, when it has none, whoever opened it.
   */
  readonly lastActor: Person;
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
  readonly heading?: Heading;
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
