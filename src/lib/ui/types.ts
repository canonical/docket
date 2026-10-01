import type { ReactNode } from "react";
import type { Heading } from "../owed/index.js";

/** A run of a line's text, in its own colour and, when it has one, text attribute. */
export interface Piece {
  readonly text: string;
  readonly fg: string;
  /** OpenTUI's text attribute, such as bold for a row's first line. */
  readonly attributes?: number;
  /**
   * Whether the run opens with a person's mark and a space, which never
   * give way when the line is cut.
   */
  readonly marked?: boolean;
}

/**
 * One block of a scrolled list, drawn whole or not at all, but for the
 * first: a group's heading, with the name the heading pinned above its
 * rows gives, or a row with what opens under it. Each carries the key
 * React names it by among its siblings, and the lines it takes.
 */
export type ListBlock =
  | {
      readonly kind: "heading";
      readonly key: string;
      readonly lines: number;
      readonly node: ReactNode;
      readonly heading: Heading;
    }
  | {
      readonly kind: "row";
      readonly key: string;
      readonly lines: number;
      readonly node: ReactNode;
    };

/** What a block of a scrolled list is: a group's heading, or a row. */
export type ListBlockKind = ListBlock["kind"];

/** Where a scrolled list starts, and what it shows from there. */
export interface ListPlacement {
  /** The place of the first block shown. */
  readonly first: number;
  /** How many blocks are shown from the first, whole but for the first. */
  readonly shown: number;
  /**
   * How many rows are cut off below the blocks shown, in whichever group,
   * which the list's last line signs; none while the room is the first
   * block's alone.
   */
  readonly below: number;
  /**
   * The heading pinned above the first block, when that block is a row of
   * a group: the heading's name, the place in the group of the first row
   * shown, counted from one, and the group's rows.
   */
  readonly pinned?: {
    readonly heading: Heading;
    readonly place: number;
    readonly size: number;
  };
}
