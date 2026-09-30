/** A run of a line's text, in its own colour and, when it has one, text attribute. */
export interface Piece {
  readonly text: string;
  readonly fg: string;
  /** OpenTUI's text attribute, such as bold for a row's first line. */
  readonly attributes?: number;
}

/**
 * What a block of a scrolled list is: a group's heading, a row, with what
 * opens under it, or anything else, such as the help's closing note.
 */
export type ListBlockKind = "heading" | "row" | "other";

/** Where a scrolled list starts, and what it shows from there. */
export interface ListPlacement {
  /** The place of the first block shown. */
  readonly first: number;
  /** How many blocks are shown from the first, whole but for the first. */
  readonly shown: number;
  /**
   * How many rows are cut off below the blocks shown, in whichever group,
   * which the list's last line signs; none while the first block is too
   * tall to share the room with the sign.
   */
  readonly below: number;
  /**
   * The heading pinned above the first block, when that block is a row of
   * a group: the heading's place among the blocks, the place in the group
   * of the first row shown, counted from one, and the group's rows.
   */
  readonly pinned?: {
    readonly heading: number;
    readonly place: number;
    readonly size: number;
  };
}
