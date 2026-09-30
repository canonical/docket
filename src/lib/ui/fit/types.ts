/**
 * Where a field is drawn: `line`, one line such as a row's, a heading,
 * the header, the counts line or the status line; `event`, the one line
 * of an event in activity; or `block`, a place with room to wrap, such as
 * the accordion, a notice, the help or the first run's lines.
 */
export type Slot = "line" | "event" | "block";

/**
 * How a field is fitted to one line: kept `whole`, or, when too narrow
 * for it, cut with `…` at its end (`cutEnd`) or in its middle
 * (`cutMiddle`); `dropOrganisation` names a team without its
 * `organisation/`, which every team of a repository shares, then cuts at
 * the end.
 */
export type LineRule = "whole" | "cutEnd" | "cutMiddle" | "dropOrganisation";

/** How a field is fitted to a block: kept `whole` on one line, or wrapped (`wrap`). */
export type BlockRule = "whole" | "wrap";

/** How one kind of field is fitted to each slot. */
export interface FitRule {
  readonly line: LineRule;
  readonly event: LineRule;
  readonly block: BlockRule;
}
