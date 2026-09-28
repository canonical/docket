import type { Meta, Story } from "../../../../testing/stories.js";
import CountsLine from "./CountsLine.js";
import type { CountsLineProps } from "./types.js";

const meta: Meta<CountsLineProps> = {
  title: "component/CountsLine",
  component: CountsLine,
};

export default meta;

/** owed counts the waits in each state. */
export const Owed: Story<CountsLineProps> = {
  args: { summary: "3 over · 2 soon · 6 on track", width: 40 },
};

/** activity counts the threads and the events of the whole window. */
export const Activity: Story<CountsLineProps> = {
  args: { summary: "9 threads · 23 events", width: 40 },
};
