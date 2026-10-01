import type { Meta, Story } from "../../../../testing/stories.js";
import GroupHeading from "./GroupHeading.js";
import type { GroupHeadingProps } from "./types.js";

const meta: Meta<GroupHeadingProps> = {
  title: "component/GroupHeading",
  component: GroupHeading,
};

export default meta;

/** Your own section in owed `by owner`: the heading keeps your mark. */
export const Owner: Story<GroupHeadingProps> = {
  args: { heading: { text: "alice", kind: "person", group: "you" }, width: 40 },
};

/** A stack's section in owed `by stack`, with the stack's full size. */
export const Stack: Story<GroupHeadingProps> = {
  args: {
    heading: {
      kind: "stack",
      repo: "example",
      number: 3,
      size: 3,
      base: "main",
    },
    width: 40,
  },
};

/** The last section of `by stack`, one of docket's own names in capitals. */
export const NotInAStack: Story<GroupHeadingProps> = {
  args: { heading: { text: "NOT IN A STACK", kind: "words" }, width: 40 },
};

/** A stack in a repository with a long short name, on a long base branch. */
export const Long: Story<GroupHeadingProps> = {
  args: {
    heading: {
      kind: "stack",
      repo: "example-repository-with-a-long-name",
      number: 7,
      size: 3,
      base: "release/example-branch-with-a-long-name",
    },
    width: 40,
  },
};

/** A team you belong to, named with its organisation, heading its section. */
export const LongTeam: Story<GroupHeadingProps> = {
  args: {
    heading: {
      text: "example-org/a-team-with-a-very-long-name",
      kind: "person",
      group: "you",
    },
    width: 40,
  },
};

/**
 * bob's section pinned above its rows while they scroll, the first row
 * shown the third of his five.
 */
export const Pinned: Story<GroupHeadingProps> = {
  args: {
    heading: { text: "bob", kind: "person", group: "team" },
    count: { text: "3 of 5", kind: "figure" },
    width: 40,
  },
};
