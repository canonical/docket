import { findActivityRow } from "../../../../testing/activity.js";
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

/** In activity: a pull request in a stack, with one owner, its newest event 20m old. */
export const ActivityStacked: Story<ThreadRowProps> = {
  args: { row: findActivityRow(12), width: 40 },
};

/** In activity: a draft pull request with no owner. */
export const ActivityDraft: Story<ThreadRowProps> = {
  args: { row: findActivityRow(14), width: 40 },
};

/** In activity: an issue two people own, named on a third line. */
export const ActivityTwoOwners: Story<ThreadRowProps> = {
  args: { row: findActivityRow(15), width: 40 },
};

/** In activity: an issue in a repository whose own file is invalid. */
export const ActivityInvalidFile: Story<ThreadRowProps> = {
  args: { row: findActivityRow(4), width: 40 },
};
