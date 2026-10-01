import type { Meta, Story } from "../../../../testing/stories.js";
import CountsLine from "./CountsLine.js";
import type { CountsLineProps } from "./types.js";

const meta: Meta<CountsLineProps> = {
  title: "component/CountsLine",
  component: CountsLine,
};

export default meta;

/** owed counts the waits in each state; the selection is the third of four of alice's. */
export const Owed: Story<CountsLineProps> = {
  args: {
    summary: "3 over · 2 soon · 6 on track",
    position: "3/4/11",
    width: 40,
  },
};

/** activity counts the threads and the events of the whole window. */
export const Activity: Story<CountsLineProps> = {
  args: { summary: "9 threads · 23 events", position: "1/9", width: 40 },
};

/** Nothing listed: the counts alone, at zero. */
export const NothingOwed: Story<CountsLineProps> = {
  args: { summary: "0 over · 0 soon · 0 on track", width: 40 },
};
