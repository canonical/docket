import type { WaitRow } from "../../../owed/index.js";
import type { ThreadDetail } from "../../../provider/index.js";
import type { ThreadSummary } from "../../../waits/index.js";

/**
 * One piece of the accordion's text, wrapped to the pane, and the
 * colour it takes: plain text, the error colour for a field in trouble,
 * or dimmed for context such as the stack.
 */
export interface DetailLine {
  readonly text: string;
  readonly tone: "text" | "error" | "muted";
  /** Shown only when it fits whole, such as when a reply began. */
  readonly optional?: boolean;
  /**
   * Ends in a dimmed `…`: the rest of the line needs the details read,
   * which is paused, such as a reply's text.
   */
  readonly pending?: boolean;
}

/**
 * What the accordion is given for a thread. Details read are whole. While
 * reading is paused and none are held, it is given what the snapshot holds,
 * marked `partial`, whose lines that need the read end in a dimmed `…`,
 * or, for a thread the snapshot holds nothing of, when reading resumes.
 */
export type ShownDetail =
  | (ThreadDetail & { readonly partial?: boolean })
  | { readonly resumes: Date };

/** What the accordion shows for a thread, before it is fitted to the pane. */
export interface DetailText {
  /** The body for the row's kind of wait, in order. */
  readonly body: readonly DetailLine[];
  /** The two stack lines of a stacked pull request, which end the accordion. */
  readonly stack: readonly DetailLine[];
}

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
   * Its owners as its row names them, such as `alice, bob` or
   * `unassigned`. Absent when the row names none, as for a closed thread:
   * its assignees that are not bots stand in.
   */
  readonly owners?: string;
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
   * The thread's details as the provider reads them: the accordion shows
   * `loading…` until they arrive, and the reason if they fail. While
   * reading is paused, what the snapshot holds, or when reading resumes.
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
}
