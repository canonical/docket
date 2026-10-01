import type { People } from "../../../config/index.js";
import type { FinishedRow } from "../../../finished/index.js";
import type { Owner, Person, WaitRow } from "../../../owed/index.js";
import type { ThreadDetail } from "../../../provider/index.js";
import type { ThreadSummary } from "../../../waits/index.js";
import type { Piece } from "../../types.js";

/**
 * One line of what the accordion shows, before it is fitted to the pane:
 * its runs, each in its own colour, and whether it wraps over as many
 * lines as it needs, as a message does, or is trimmed to one.
 */
export interface DetailLine {
  readonly pieces: readonly Piece[];
  readonly fit: "trimmed" | "wrapped";
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
   * Who opened the thread, when it was open at the last refresh: its last
   * actor, at its opening, while nobody has written on it. A closed
   * thread's last activity is its close, so it names no opener.
   */
  readonly author?: Person;
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
   * The selected row's running wait, whose kind decides the body, the
   * thread at rest, which takes the close body, or a finished thread,
   * which takes the finished body.
   * Maps to DSL role: reply body, review body, close body, finished body (cardinality: 1)
   */
  row: WaitRow | RestingThread | FinishedRow;
  /**
   * The thread's details as the provider reads them: until they arrive the
   * accordion shows what the snapshot holds, and the reason if they fail.
   * While reading is paused, what the snapshot holds, or when reading
   * resumes. Absent for a finished thread none of whose lines wait on
   * the details, which then shows what the list gives and reads nothing.
   * Maps to DSL role: loading line, loaded body, failed line (cardinality: 0..1)
   */
  detail?: Promise<ShownDetail>;
  /**
   * The kind of the running wait of each thread in the list, by
   * reference, such as `review` for `example#13`, which names the
   * neighbours of a pull request in its stack.
   */
  waiting: Readonly<Record<string, string>>;
  /**
   * Whether the list runs a clock, as owed and finished do, so the item's
   * state bar runs down beside the accordion; in activity its column is
   * blank.
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
