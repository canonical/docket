import type { ReactNode } from "react";
import type { Owner } from "../owed/index.js";

/** A run of a line's text, in its own colour and, when it has one, text attribute. */
export interface Piece {
  readonly text: string;
  readonly fg: string;
  /** OpenTUI's text attribute, such as bold for a row's first line. */
  readonly attributes?: number;
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
      readonly heading: Owner;
    }
  | {
      readonly kind: "row";
      readonly key: string;
      readonly lines: number;
      readonly node: ReactNode;
    };

/** What a block of a scrolled list is: a group's heading, or a row. */
export type ListBlockKind = ListBlock["kind"];
