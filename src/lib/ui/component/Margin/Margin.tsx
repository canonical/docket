import type { ReactNode } from "react";
import type { WaitState } from "../../../owed/index.js";
import { tokens } from "../../../tokens/index.js";
import type { MarginProps } from "./types.js";

/**
 * The bar's colour: the error and warning colours for a wait over its
 * target or due soon, and the border colour, which reads as neutral, for
 * one on track.
 */
const barColours: Readonly<Record<WaitState, string>> = {
  over: tokens["color.text.error"],
  soon: tokens["color.text.warning"],
  onTrack: tokens["color.border"],
};

/**
 * The bar's glyph on a line: heavy for a wait over its target or due soon,
 * which both want attention, and light on track, so every pair of states
 * differs without colour too; the half-height end on the item's last line,
 * so two items in one state read as two strokes rather than one.
 */
function chooseBar(state: WaitState, last: boolean): string {
  const heavy = state !== "onTrack";
  if (last) {
    return heavy
      ? tokens["glyph.bar.attention.end"]
      : tokens["glyph.bar.onTrack.end"];
  }
  return heavy ? tokens["glyph.bar.attention"] : tokens["glyph.bar.onTrack"];
}

/**
 * The two-cell margin at the left of an item: its row, its accordion and,
 * in activity, its events. Column 1 is the state bar, one continuous
 * stroke down every line of the item, ending on its last; it is blank
 * where nothing runs a clock, as in activity. Column 2 is the stack mark,
 * dashed and dimmed, on every line of a pull request in a stack, the last
 * included, since the stack goes on elsewhere in the list; it means only
 * "in a stack", so neighbouring marks may belong to different stacks.
 *
 * `import { Margin } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.row_margin
 */
const Margin = ({ state, stacked, lines, ends }: MarginProps): ReactNode => (
  <box flexDirection="column" width={2} flexShrink={0}>
    {Array.from({ length: lines }, (_, line) => (
      // The lines of a margin never reorder, so their place is their key.
      // biome-ignore lint/suspicious/noArrayIndexKey: see above.
      <text key={line}>
        <span fg={state && barColours[state]}>
          {state ? chooseBar(state, ends && line === lines - 1) : " "}
        </span>
        <span fg={tokens["color.text.muted"]}>
          {stacked ? tokens["glyph.stack"] : " "}
        </span>
      </text>
    ))}
  </box>
);

export default Margin;
