import type { Meta, StoryObj } from "@aztlan/lago-react";
import { drawAtWidth } from "../../../../testing/stories.js";
import ProgressLine from "./ProgressLine.js";
import type { ProgressLineProps } from "./types.js";

const meta = {
  title: "component/ProgressLine",
  component: ProgressLine,
  render: drawAtWidth(ProgressLine),
} satisfies Meta<typeof ProgressLine>;

export default meta;

/** Part way through the pages of the repositories begun. */
export const Halfway: StoryObj<typeof meta> = {
  args: { fetched: 50, total: 89, width: 38 },
};

/** Four digits of pages on each side of the slash. */
export const Long: StoryObj<typeof meta> = {
  args: { fetched: 1234, total: 9999, width: 38 },
};
