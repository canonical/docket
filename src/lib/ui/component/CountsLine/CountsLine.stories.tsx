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
    summary: {
      fields: [
        { text: "3 over", kind: "words" },
        { text: "2 soon", kind: "words" },
        { text: "6 on track", kind: "words" },
      ],
    },
    position: { text: "3/4/11", kind: "figure" },
    width: 40,
  },
};

/** activity counts the threads and the events of the whole window. */
export const Activity: Story<CountsLineProps> = {
  args: {
    summary: {
      fields: [
        { text: "9 threads", kind: "words" },
        { text: "23 events", kind: "words" },
      ],
    },
    position: { text: "1/9", kind: "figure" },
    width: 40,
  },
};

/** Nothing listed: the counts alone, at zero. */
export const NothingOwed: Story<CountsLineProps> = {
  args: {
    summary: {
      fields: [
        { text: "0 over", kind: "words" },
        { text: "0 soon", kind: "words" },
        { text: "0 on track", kind: "words" },
      ],
    },
    width: 40,
  },
};

/** owed with four digits of waits in every state: its widest summary. */
export const Long: Story<CountsLineProps> = {
  args: {
    summary: {
      fields: [
        { text: "9999 over", kind: "words" },
        { text: "9999 soon", kind: "words" },
        { text: "9999 on track", kind: "words" },
      ],
    },
    width: 40,
  },
};
