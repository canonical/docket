import type { Meta, Story } from "../../../../../../testing/stories.js";
import Margin from "./Margin.js";
import type { MarginProps } from "./types.js";

const meta: Meta<MarginProps> = {
  title: "component/ThreadRow/Margin",
  component: Margin,
};

export default meta;

/** A pull request in a stack, over its target. */
export const OverInStack: Story<MarginProps> = {
  args: { state: "over", stacked: true, lines: 2 },
};

/** A thread due soon, in no stack. */
export const Soon: Story<MarginProps> = {
  args: { state: "soon", stacked: false, lines: 2 },
};

/** A pull request in a stack, on track, on a row with a line of owners. */
export const OnTrackThreeLines: Story<MarginProps> = {
  args: { state: "onTrack", stacked: true, lines: 3 },
};
