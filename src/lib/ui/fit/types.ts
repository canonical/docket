/**
 * Where a field is drawn: `line`, one line such as a row's, a heading,
 * the header, the counts line or the status line; or `block`, a place
 * with room to wrap, such as the accordion, a notice, the help or the
 * first run's lines.
 */
export type Slot = "line" | "block";

/**
 * How a field is fitted to one line too narrow for it: kept `whole`, or
 * cut at its end with `…` (`cutEnd`).
 */
export type LineRule = "whole" | "cutEnd";

/** How a field is fitted to a block: kept `whole` on one line, or wrapped (`wrap`). */
export type BlockRule = "whole" | "wrap";

/** How one kind of field is fitted to each slot. */
export interface FitRule {
  readonly line: LineRule;
  readonly block: BlockRule;
}
