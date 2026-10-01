import { findActivityRow } from "../../../../testing/activity.js";
import { findFinishedRow } from "../../../../testing/finished.js";
import {
  botReview,
  crowdedReply,
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

/**
 * A reply on an issue whose reference, kinds and distance leave too few
 * cells for the author's login at 40 columns: the author leaves the line.
 */
export const AuthorLeaves: Story<ThreadRowProps> = {
  args: { row: crowdedReply, width: 40 },
};

/** A review on a bot's pull request: its login cut, its mark whole. */
export const BotAuthor: Story<ThreadRowProps> = {
  args: { row: botReview, width: 40 },
};

/**
 * The same review selected: its title wraps in full, and the owner, who
 * does not fit beside its last line, takes a line of its own.
 */
export const BotAuthorSelected: Story<ThreadRowProps> = {
  args: { row: botReview, selected: true, width: 40 },
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

/** A finished pull request in a stack that ended within its target: the time it was open, the bar green. */
export const FinishedWithin: Story<ThreadRowProps> = {
  args: { row: findFinishedRow("example#2"), width: 40 },
};

/** A finished issue that ended past its target: how far past, in the error colour, the bar heavy. */
export const FinishedOver: Story<ThreadRowProps> = {
  args: { row: findFinishedRow("example#7"), width: 40 },
};

/** A finished draft a label exempts: no verdict and no bar, the ending's age bare. */
export const FinishedExempt: Story<ThreadRowProps> = {
  args: { row: findFinishedRow("example#9"), width: 40 },
};
