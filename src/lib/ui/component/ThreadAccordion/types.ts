import type { People } from "../../../config/index.js";
import type { FieldKind, Owner, WaitRow } from "../../../owed/index.js";
import type { ThreadDetail } from "../../../provider/index.js";
import type { ThreadSummary } from "../../../waits/index.js";
import type { Piece } from "../../types.js";

/**
 * One line of what the accordion shows, before it is fitted to the pane:
 * its runs, each in its own colour, and the kind of text it is, which the
 * fitting table fits it by in a block, as it does every field.
 */
export interface DetailLine {
  readonly pieces: readonly Piece[];
  readonly kind: FieldKind;
  /**
   * The most lines it takes, where its kind would wrap it over more: one
   * for a line the details complete in place, which must not change
   * height while they load. Held to one line, it is fitted by its kind's
   * rule for a line.
   */
  readonly most?: 1;
  /**
   * The runs that give way, in order, when the line, held to one, does
   * not fit, each cut once by its kind's rule for a line: all but the last
   * keep 16 cells at least, and the last may leave the line. The other
   * runs, docket's own words, stay whole: a stack's base branch gives way
   * first, then its repository's short name, and `stack 7 · 2 of 3 · →`
   * stays.
   */
  readonly gives?: readonly number[];
  /**
   * Whether the line takes only the lines left once every other line has
   * its own, as the owners line does before a review's checks.
   */
  readonly yields?: boolean;
  /** Shown only when it fits whole, such as when a reply began. */
  readonly optional?: boolean;
}

/** What the accordion shows for a thread, before it is fitted to the pane. */
export interface DetailText {
  /** The body for the row's kind of wait, in order. */
  readonly body: readonly DetailLine[];
  /** The stack lines of a stacked pull request, which end the accordion. */
  readonly stack: readonly DetailLine[];
}

/**
 * What the accordion is given for a thread. Details read are whole. While
 * reading is paused and none are held, it is given what the snapshot holds,
 * marked `partial`, which completes none of the lines the details complete,
 * or, for a thread the snapshot holds nothing of, when reading resumes.
 */
export type ShownDetail =
  | (ThreadDetail & { readonly partial?: boolean })
  | { readonly resumes: Date };

/**
 * A thread no wait runs on, such as a closed one in activity, which the
 * accordion shows with the close body, from the thread's details.
 */
export interface RestingThread {
  /** The short name of its repository, which the stack lines name. */
  readonly repo: string;
  /** The thread, whose place in a stack gives the stack lines. */
  readonly thread: ThreadSummary;
  /**
   * Its owners as its row names them, each with its group, or
   * `unassigned`. Absent when the row names none, as for a closed thread:
   * its assignees that are not bots stand in.
   */
  readonly owners?: readonly Owner[];
  /**
   * Each login's group in the thread's repository, which names its
   * assignees and whoever wrote last once the details give them.
   */
  readonly people: People;
  /** The login gh is signed in with, when it is known: `you` among them. */
  readonly viewer?: string;
}

/** Props for the ThreadAccordion component. */
export interface ThreadAccordionProps {
  /**
   * The selected row's running wait, whose kind decides the body, or the
   * thread at rest, which takes the close body.
   * Maps to DSL role: reply body, review body, close body (cardinality: 1)
   */
  row: WaitRow | RestingThread;
  /**
   * The thread's details as the provider reads them: until they arrive the
   * accordion shows what the snapshot holds, and the reason if they fail.
   * While reading is paused, what the snapshot holds, or when reading
   * resumes.
   * Maps to DSL role: loading line, loaded body, failed line (cardinality: 1)
   */
  detail: Promise<ShownDetail>;
  /**
   * The kind of the running wait of each thread in the list, by
   * reference, such as `review` for `example#13`, which names the
   * neighbours of a pull request in its stack.
   */
  waiting: Readonly<Record<string, string>>;
  /**
   * Whether the list runs a clock, as owed does, so the item's state bar
   * runs down beside the accordion; in activity its column is blank.
   */
  clock: boolean;
  /** The instant ages are measured at. */
  now: Date;
  /** The time zone a time of day is written in, such as `Europe/Paris`. */
  timezone: string;
  /** The width of the pane, in display cells. */
  width: number;
  /**
   * Told, after the details arrive or fail, how many lines the accordion
   * drew, which can pass what the snapshot gave.
   */
  onLines?: (lines: number) => void;
}
