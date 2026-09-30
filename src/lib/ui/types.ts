import type { ReactNode } from "react";
import type { Owner } from "../owed/index.js";

/** A run of a line's text, in its own colour and, when it has one, text attribute. */
export interface Piece {
  readonly text: string;
  readonly fg: string;
  /** OpenTUI's text attribute, such as bold for a row's first line. */
  readonly attributes?: number;
}

/** What every block of a scrolled list carries. */
interface ListBlockBase {
  /** What names the block among its siblings, as React keys it. */
  readonly key: string;
  /** The lines the block takes. */
  readonly lines: number;
  readonly node: ReactNode;
}

/**
 * One block of a scrolled list, drawn whole or not at all, but for the
 * first: a group's heading, with the name the heading pinned above its
 * rows gives, or a row with what opens under it.
 */
export type ListBlock =
  | (ListBlockBase & { readonly kind: "heading"; readonly heading: Owner })
  | (ListBlockBase & { readonly kind: "row" });

/** What a block of a scrolled list is: a group's heading, or a row. */
export type ListBlockKind = ListBlock["kind"];
