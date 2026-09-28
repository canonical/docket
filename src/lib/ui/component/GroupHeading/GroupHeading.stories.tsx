import type { Meta, Story } from "../../../../testing/stories.js";
import GroupHeading from "./GroupHeading.js";
import type { GroupHeadingProps } from "./types.js";

const meta: Meta<GroupHeadingProps> = {
  title: "component/GroupHeading",
  component: GroupHeading,
};

export default meta;

/** An owner's section in owed `by owner`. */
export const Owner: Story<GroupHeadingProps> = {
  args: { text: "alice", width: 40 },
};

/** A stack's section in owed `by stack`, with the stack's full size. */
export const Stack: Story<GroupHeadingProps> = {
  args: { text: "example stack 3 · 3 PRs → main", width: 40 },
};

/** The last section of `by stack`. */
export const NotInAStack: Story<GroupHeadingProps> = {
  args: { text: "NOT IN A STACK", width: 40 },
};
