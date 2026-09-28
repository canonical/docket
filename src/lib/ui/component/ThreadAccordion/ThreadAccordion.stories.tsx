import {
  failDetail,
  overReviewDetail,
  pendingDetail,
  sharedCloseDetail,
  soonReplyDetail,
} from "../../../../testing/details.js";
import { recordedNow } from "../../../../testing/recorded.js";
import {
  overReview,
  sharedClose,
  soonReply,
} from "../../../../testing/rows.js";
import type { Meta, Story } from "../../../../testing/stories.js";
import ThreadAccordion from "./ThreadAccordion.js";
import type { ThreadAccordionProps } from "./types.js";

const meta: Meta<ThreadAccordionProps> = {
  title: "component/ThreadAccordion",
  component: ThreadAccordion,
};

export default meta;

const reading = {
  waiting: { "example#13": "close" },
  now: recordedNow,
  timezone: "Europe/Paris",
  width: 40,
};

/** A review on a stacked pull request: who asked, what changed, the checks, the stack. */
export const Review: Story<ThreadAccordionProps> = {
  args: {
    ...reading,
    row: overReview,
    detail: Promise.resolve(overReviewDetail),
  },
};

/** A reply: the latest message in full, then when the reply began. */
export const Reply: Story<ThreadAccordionProps> = {
  args: {
    ...reading,
    row: soonReply,
    detail: Promise.resolve(soonReplyDetail),
  },
};

/** A close: the age and owners, the last activity, the labels decoded. */
export const Close: Story<ThreadAccordionProps> = {
  args: {
    ...reading,
    row: sharedClose,
    detail: Promise.resolve(sharedCloseDetail),
  },
};

/** The details are still being read. */
export const Loading: Story<ThreadAccordionProps> = {
  args: { ...reading, row: soonReply, detail: pendingDetail },
};

/** Reading the details failed, with a short reason. */
export const Failed: Story<ThreadAccordionProps> = {
  args: {
    ...reading,
    row: overReview,
    detail: failDetail(new Error("GitHub gave no answer within 10 seconds.")),
  },
};
