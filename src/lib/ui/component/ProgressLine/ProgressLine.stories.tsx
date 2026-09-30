import type { Meta, Story } from "../../../../testing/stories.js";
import ProgressLine from "./ProgressLine.js";
import type { ProgressLineProps } from "./types.js";

const meta: Meta<ProgressLineProps> = {
  title: "component/ProgressLine",
  component: ProgressLine,
};

export default meta;

/** Part way through the pages of the repositories begun. */
export const Halfway: Story<ProgressLineProps> = {
  args: { fetched: 50, total: 89, width: 38 },
};
