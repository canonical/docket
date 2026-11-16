import type { Meta, StoryObj } from "@aztlan/lago-react";
import { drawAtWidth } from "../../../../testing/stories.js";
import EmptyState from "./EmptyState.js";

const meta = {
  title: "component/EmptyState",
  component: EmptyState,
  render: drawAtWidth(EmptyState),
} satisfies Meta<typeof EmptyState>;

export default meta;

/** owed with no running wait. */
export const NothingOwed: StoryObj<typeof meta> = {
  args: { message: { text: "nothing owed", kind: "words" }, width: 40 },
};

/** The longest message the list area gives: owed, with nothing owed. */
export const Long: StoryObj<typeof meta> = {
  args: { message: { text: "nothing owed", kind: "words" }, width: 40 },
};
