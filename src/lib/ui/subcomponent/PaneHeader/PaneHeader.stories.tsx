import type { Meta, Story } from "../../../../testing/stories.js";
import PaneHeader from "./PaneHeader.js";
import type { PaneHeaderProps } from "./types.js";

const meta: Meta<PaneHeaderProps> = {
  title: "subcomponent/PaneHeader",
  component: PaneHeader,
};

export default meta;

/** owed with no grouping: one list, then the sort, dimmed. */
export const Owed: Story<PaneHeaderProps> = {
  args: {
    title: "owed",
    address: "one list",
    sort: "overdue first",
    width: 40,
  },
};

/** owed grouped by owner. */
export const OwedByOwner: Story<PaneHeaderProps> = {
  args: {
    title: "owed",
    address: "by owner",
    sort: "overdue first",
    width: 40,
  },
};

/** activity names its window, then its grouping, then its sort. */
export const Activity: Story<PaneHeaderProps> = {
  args: {
    title: "activity",
    address: "24h · by kind",
    sort: "newest first",
    width: 40,
  },
};

/** The help overlay's title, with no address. */
export const Help: Story<PaneHeaderProps> = {
  args: { title: "help", width: 40 },
};
