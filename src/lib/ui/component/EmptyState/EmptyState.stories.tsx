import type { Meta, Story } from "../../../../testing/stories.js";
import EmptyState from "./EmptyState.js";
import type { EmptyStateProps } from "./types.js";

const meta: Meta<EmptyStateProps> = {
  title: "component/EmptyState",
  component: EmptyState,
};

export default meta;

/** owed with no running wait. */
export const NothingOwed: Story<EmptyStateProps> = {
  args: { message: { text: "nothing owed", kind: "words" }, width: 40 },
};
