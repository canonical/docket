import type { Meta, Story } from "../../../../testing/stories.js";
import Margin from "./Margin.js";
import type { MarginProps } from "./types.js";

const meta: Meta<MarginProps> = {
  title: "component/Margin",
  component: Margin,
};

export default meta;

/** A pull request in a stack, over its target: a closed two-line row. */
export const OverInStack: Story<MarginProps> = {
  args: { state: "over", stacked: true, lines: 2, ends: true },
};

/** A thread due soon, in no stack, its accordion following. */
export const SoonOpen: Story<MarginProps> = {
  args: { state: "soon", stacked: false, lines: 2, ends: false },
};

/** A pull request in a stack, on track, on a row with a line of owners. */
export const OnTrackThreeLines: Story<MarginProps> = {
  args: { state: "onTrack", stacked: true, lines: 3, ends: true },
};

/** A pull request in a stack, in activity, where no clock runs. */
export const NoClock: Story<MarginProps> = {
  args: { stacked: true, lines: 2, ends: true },
};

/** A selected row and its accordion at their tallest: twelve lines of bar. */
export const Long: Story<MarginProps> = {
  args: { state: "over", stacked: true, lines: 12, ends: true },
};
