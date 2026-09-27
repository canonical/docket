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
  args: { title: "owed", width: 40 },
};

/** owed grouped by owner. */
export const OwedByOwner: Story<PaneHeaderProps> = {
  args: { title: "owed", address: "by owner", width: 40 },
};

/** activity names its window, then its grouping. */
export const Activity: Story<PaneHeaderProps> = {
  args: { title: "activity", address: "24h · by kind", width: 40 },
};

/** The help overlay's title. */
export const Help: Story<PaneHeaderProps> = {
  args: { title: "help", width: 40 },
};
