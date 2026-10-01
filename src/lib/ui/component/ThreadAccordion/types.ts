import type { People } from "../../../config/index.js";
import type { FinishedRow } from "../../../finished/index.js";
import type {
  Field,
  FieldKind,
  Owner,
  Person,
  WaitRow,
} from "../../../owed/index.js";
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
   * The runs that leave the line whole, in order, while the line, held to
   * one, does not fit, before any is cut: a stack's repository name.
   */
  readonly drops?: readonly number[];
  /**
   * The one run then cut, once, by its kind's rule for a line, to the room
   * the others leave: a stack's base branch. Every other run, docket's own
   * words such as `stack 7 · 2 of 3 · →`, stays whole.
   */
  readonly cuts?: number;
  /**
   * Whether the line takes only the lines left once every other line has
   * its own, as the owners line does before a review's checks.
   */
  readonly yields?: boolean;
  /**
   * Whether the details complete it: it ends in a dimmed `…` until they
   * arrive, which fitting draws, and is never ended with a second one.
   */
  readonly pending?: boolean;
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
  /** `invalid repository file`, when the repository's own file is invalid. */
  readonly invalidFile?: Field;
}

/** The props every row's accordion takes. */
interface AccordionProps {
  /**
   * The kind of the running wait of each thread in the list, by
   * reference, such as `review` for `example#13`, which names the
   * neighbours of a pull request in its stack.
   */
  waiting: Readonly<Record<string, string>>;
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

/**
 * Props for the ThreadAccordion component: owed's wait or a thread at
 * rest, whose lines wait on its details, or a finished thread, whose
 * lines come with the list.
 */
export type ThreadAccordionProps = AccordionProps &
  (
    | {
        /**
         * The selected row's running wait, whose kind decides the body,
         * or the thread at rest, which takes the close body.
         * Maps to DSL role: reply body, review body, close body (cardinality: 1)
         */
        row: WaitRow | RestingThread;
        /**
         * The thread's details as the provider reads them: until they
         * arrive the accordion shows what the snapshot holds, and the
         * reason if they fail. While reading is paused, what the
         * snapshot holds, or when reading resumes.
         * Maps to DSL role: loading line, loaded body, failed line (cardinality: 1)
         */
        detail: Promise<ShownDetail>;
        /**
         * Whether the list runs a clock, as owed does, so the wait's
         * state bar runs down beside the accordion; in activity its
         * column is blank.
         */
        clock: boolean;
      }
    | {
        /**
         * A finished thread, which takes the finished body, its bar its
         * verdict.
         * Maps to DSL role: finished body (cardinality: 1)
         */
        row: FinishedRow;
        /**
         * The details its stack's neighbours wait on, for a pull request
         * in a stack; absent otherwise, when the accordion shows what the
         * list gives and reads nothing.
         * Maps to DSL role: loaded body, failed line (cardinality: 0..1)
         */
        detail?: Promise<ShownDetail>;
        /** A finished thread's bar is its verdict, so it takes no clock. */
        clock?: never;
      }
  );
