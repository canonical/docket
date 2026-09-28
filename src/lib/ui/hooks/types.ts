/**
 * The types of the terminal interface's hooks, beside them as the React
 * rules ask.
 */

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
export interface UseListScrollProps<Block extends { readonly lines: number }> {
  /**
   * The list's blocks, in order: a heading, or a row with what opens under
   * it. Each gives the lines it takes.
   */
  readonly blocks: readonly Block[];
  /**
   * The first block that must be whole in view: the selected row, or the
   * heading above it when the row is the first of its group.
   */
  readonly from: number;
  /** The last block that must be whole in view: the selected row. */
  readonly to: number;
  /** The lines the list region has. */
  readonly room: number;
}

/**
 * The blocks to draw, in order: whole blocks only, as many as fit the
 * room, and always the first, whatever its height.
 */
export type UseListScrollResult<Block> = readonly Block[];
