import type { Meta, Story } from "../../../../testing/stories.js";
import PaneHeader from "./PaneHeader.js";
import type { PaneHeaderProps } from "./types.js";

const meta: Meta<PaneHeaderProps> = {
  title: "subcomponent/PaneHeader",
  component: PaneHeader,
};

export default meta;

/** owed with no grouping: the mode name alone. */
export const Owed: Story<PaneHeaderProps> = {
  args: { title: { text: "owed", kind: "words" }, width: 40 },
};

/** owed grouped by owner. */
export const OwedByOwner: Story<PaneHeaderProps> = {
  args: {
    title: { text: "owed", kind: "words" },
    address: { text: "by owner", kind: "words" },
    width: 40,
  },
};

/** activity names its window, then its grouping. */
export const Activity: Story<PaneHeaderProps> = {
  args: {
    title: { text: "activity", kind: "words" },
    address: { text: "24h · by kind", kind: "words" },
    width: 40,
  },
};

/** The help overlay's title. */
export const Help: Story<PaneHeaderProps> = {
  args: { title: { text: "help", kind: "words" }, width: 40 },
};

/** An editor open on a thread of a repository with a long short name. */
export const Long: Story<PaneHeaderProps> = {
  args: {
    title: {
      text: "requesting review example-repository-with-a-long-name#12345",
      kind: "identifier",
    },
    width: 40,
  },
};
