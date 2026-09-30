/**
 * The types of the terminal interface's hooks, beside them as the React
 * rules ask.
 */

import type { ListBlock, ListPlacement } from "../types.js";

/**
 * The keys of one line of the help, and of one hint in the key bar: one
 * command, or neighbouring commands that share a label, such as the two
 * that switch mode.
 */
export interface KeyCommand {
  /** The first key of each command, as shown: `←`, `→`. */
  readonly keys: readonly string[];
  /** The other keys of the same commands: `h`, `l`. */
  readonly alternates: readonly string[];
  /** What the keys do: `switch mode (owed ↔ activity)`. */
  readonly label: string;
  /**
   * The short label in the key bar, such as `mode`: empty for a key shown
   * alone, such as `?`, and absent for a key the bar leaves out.
   */
  readonly hint?: string;
  /** What the keys act on, which groups the help: `Mode`, `App`. */
  readonly group: string;
  /** Lines the help shows under the keys, such as `docket opens owed`. */
  readonly notes: readonly string[];
}

/** Props for the useCommands hook. */
export interface UseCommandsProps {
  /**
   * `active` for the commands the keys run now, as the key bar shows;
   * `registered` for every command bound, as the help lists.
   */
  readonly visibility: "active" | "registered";
}

/** The commands, in the order they were bound. */
export type UseCommandsResult = readonly KeyCommand[];

/** Props for the useListScroll hook. */
export interface UseListScrollProps {
  /**
   * The list's blocks, in order: a heading, or a row with what opens
   * under it. Each gives what it is and the lines it takes.
   */
  readonly blocks: readonly ListBlock[];
  /**
   * The first block that must be whole in view: the selected row, or the
   * heading above it when the row is the first of its group.
   */
  readonly from: number;
  /** The last block that must be whole in view: the selected row. */
  readonly to: number;
  /** The lines the list region has. */
  readonly room: number;
  /**
   * The first block shown when the list is drawn anew, such as where it
   * was scrolled before the help or a pane too small took its place; the
   * top of the list when absent.
   */
  readonly first?: number;
}

/** Result of the useListScroll hook: what the list draws, and from where. */
export interface UseListScrollResult extends Omit<ListPlacement, "shown"> {
  /**
   * The blocks to draw, in order: whole blocks only, as many as fit the
   * room between the pinned heading and the sign of the rows cut off, and
   * always the first, whatever its height.
   */
  readonly shown: readonly ListBlock[];
}

/**
 * Result of the useDrawnLines hook: what a list counts for the selected
 * item's accordion, and how the accordion tells it what it drew.
 */
export interface UseDrawnLinesResult {
  /**
   * The lines the accordion of the item `key` drew last, or `counted`,
   * what the snapshot gives, until it has drawn.
   */
  readonly measure: (key: string, counted: number) => number;
  /** Records the lines the accordion of the item `key` drew. */
  readonly report: (key: string) => (lines: number) => void;
}
