import { findActivityRow } from "../../../../testing/activity.js";
import type { Meta, Story } from "../../../../testing/stories.js";
import ActivityRow from "./ActivityRow.js";
import type { ActivityRowProps } from "./types.js";

const meta: Meta<ActivityRowProps> = {
  title: "component/ActivityRow",
  component: ActivityRow,
};

export default meta;

/** A pull request in a stack, with one owner. */
export const Stacked: Story<ActivityRowProps> = {
  args: { row: findActivityRow(12), width: 40 },
};

/** A draft pull request with no owner. */
export const Draft: Story<ActivityRowProps> = {
  args: { row: findActivityRow(14), width: 40 },
};

/** An issue two people own, named on a third line. */
export const TwoOwners: Story<ActivityRowProps> = {
  args: { row: findActivityRow(15), width: 40 },
};

/** An issue in a repository whose own file is invalid. */
export const InvalidFile: Story<ActivityRowProps> = {
  args: { row: findActivityRow(4), width: 40 },
};
