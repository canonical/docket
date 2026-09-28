import type { ReactNode } from "react";
import type { WaitState } from "../../../../../owed/index.js";
import { tokens } from "../../../../../tokens/index.js";
import type { MarginProps } from "./types.js";

/**
 * The colour of the state marker: the field-health colours for a wait
 * over its target or due soon, and the border colour, which reads as
 * neutral, for one on track.
 */
const markerColours: Readonly<Record<WaitState, string>> = {
  over: tokens["color.text.error"],
  soon: tokens["color.text.warning"],
  onTrack: tokens["color.border"],
};

/**
 * The two-cell margin at the left of a thread row. Column 1 is the state
 * marker `▌`, on the first line only, and blank when nothing runs a
 * clock, as in activity; column 2 is the stack rule `┃`, on
 * every line of a pull request in a stack, dimmed, because it means only
 * "in a stack": neighbouring rules may belong to different stacks.
 *
 * @implements apps_docket.component.row_margin
 */
const Margin = ({ state, stacked, lines }: MarginProps): ReactNode => (
  <box flexDirection="column" width={2} flexShrink={0}>
    {Array.from({ length: lines }, (_, line) => (
      // The lines of a margin never reorder, so their place is their key.
      // biome-ignore lint/suspicious/noArrayIndexKey: see above.
      <text key={line}>
        <span fg={state && markerColours[state]}>
          {line === 0 && state ? "▌" : " "}
        </span>
        <span fg={tokens["color.text.muted"]}>{stacked ? "┃" : " "}</span>
      </text>
    ))}
  </box>
);

export default Margin;
