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
  args: {
    summary: { text: "3 over · 2 soon · 6 on track", kind: "words" },
    width: 40,
  },
};

/** activity counts the threads and the events of the whole window. */
export const Activity: Story<CountsLineProps> = {
  args: {
    summary: { text: "9 threads · 23 events", kind: "words" },
    width: 40,
  },
};

/** owed with four digits of waits in every state: its widest summary. */
export const Long: Story<CountsLineProps> = {
  args: {
    summary: { text: "9999 over · 9999 soon · 9999 on track", kind: "words" },
    width: 40,
  },
};
