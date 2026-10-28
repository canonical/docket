import type { ColorInput } from "@opentui/core";
import type { ReactNode } from "react";
import type { Verdict } from "../../../endings/index.js";
import type { WaitState } from "../../../owed/index.js";
import { tokens } from "../../../tokens/index.js";
import type { MarginProps } from "./types.js";

/**
 * The bar's colour: the error and warning colours for a wait over its
 * target or due soon, and the border colour, which reads as neutral, for
 * one on track. A finished thread that ended past its target takes the
 * error colour too, and one that ended within it the success colour.
 */
const barColours: Readonly<Record<WaitState | Verdict, ColorInput>> = {
  over: tokens["color.text.error"],
  soon: tokens["color.text.warning"],
  onTrack: tokens["color.border"],
  within: tokens["color.text.success"],
};

/**
 * The bar's glyph on a line: heavy for a wait over its target or due soon,
 * and for a finished thread that ended past its target, which all want
 * attention, and light on track or within the target, so every pair of
 * states differs without colour too; the half-height end on the item's
 * last line, so two items in one state read as two strokes rather than
 * one.
 */
function chooseBar(state: WaitState | Verdict, last: boolean): string {
  const heavy = state === "over" || state === "soon";
  if (last) {
    return heavy
      ? tokens["glyph.bar.attention.end"]
      : tokens["glyph.bar.onTrack.end"];
  }
  return heavy ? tokens["glyph.bar.attention"] : tokens["glyph.bar.onTrack"];
}

/**
 * The two-cell margin at the left of an item: its row, its accordion and,
 * its events or its ending. Column 1 is the state bar, one continuous
 * stroke down every line of the item, ending on its last; it is blank
 * where nothing runs a clock, as in activity. In finished it gives the
 * verdict: heavy and red past the target, light and green within it, and
 * blank where a label exempts the thread. Column 2 is the stack mark,
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
