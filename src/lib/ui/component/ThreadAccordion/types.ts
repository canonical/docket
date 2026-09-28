import type { WaitRow } from "../../../owed/index.js";
import type { ThreadDetail } from "../../../provider/index.js";

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
}

/** What the accordion shows for a thread, before it is fitted to the pane. */
export interface DetailText {
  /** The body for the row's kind of wait, in order. */
  readonly body: readonly DetailLine[];
  /** The two stack lines of a stacked pull request, which end the accordion. */
  readonly stack: readonly DetailLine[];
}

/** Props for the ThreadAccordion component. */
export interface ThreadAccordionProps {
  /**
   * The selected row, whose kind of wait decides the body.
   * Maps to DSL role: reply body, review body, close body (cardinality: 1)
   */
  row: WaitRow;
  /**
   * The thread's details as the provider reads them: the accordion shows
   * `loading…` until they arrive, and the reason if they fail.
   * Maps to DSL role: loading line, loaded body, failed line (cardinality: 1)
   */
  detail: Promise<ThreadDetail>;
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
}
