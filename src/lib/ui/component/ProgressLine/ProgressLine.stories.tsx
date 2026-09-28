import type { Meta, Story } from "../../../../testing/stories.js";
import ProgressLine from "./ProgressLine.js";
import type { ProgressLineProps } from "./types.js";

const meta: Meta<ProgressLineProps> = {
  title: "component/ProgressLine",
  component: ProgressLine,
};

export default meta;

/** Part way through a repository's pages. */
export const Halfway: Story<ProgressLineProps> = {
  args: { fetched: 50, total: 89, width: 38 },
};

/** Before the first page tells how many there are. */
export const Starting: Story<ProgressLineProps> = {
  args: { fetched: 0, total: 0, width: 38 },
};
