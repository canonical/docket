import {
  draftClose,
  overReview,
  sharedClose,
  soonReply,
} from "../../../../testing/rows.js";
import type { Meta, Story } from "../../../../testing/stories.js";
import ThreadRow from "./ThreadRow.js";
import type { ThreadRowProps } from "./types.js";

const meta: Meta<ThreadRowProps> = {
  title: "component/ThreadRow",
  component: ThreadRow,
};

export default meta;

/** A review over its target on a stacked pull request, its checks failing, selected. */
export const OverReviewSelected: Story<ThreadRowProps> = {
  args: { row: overReview, selected: true, width: 40 },
};

/** A reply due soon that nobody is assigned to. */
export const SoonReply: Story<ThreadRowProps> = {
  args: { row: soonReply, width: 40 },
};

/** The close of a draft pull request, on track, in a stack. */
export const DraftClose: Story<ThreadRowProps> = {
  args: { row: draftClose, width: 40 },
};

/** A close three people own, each named on a third line. */
export const SharedClose: Story<ThreadRowProps> = {
  args: { row: sharedClose, width: 40 },
};
