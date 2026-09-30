import {
  failDetail,
  overReviewDetail,
  pauseDetail,
  pendingDetail,
  sharedCloseDetail,
  soonReplyDetail,
} from "../../../../testing/details.js";
import { teamSettings } from "../../../../testing/facts.js";
import {
  longReviewDetail,
  longSharedReview,
} from "../../../../testing/long.js";
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
  clock: true,
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

/**
 * The same review while its details are read: the snapshot's lines at
 * once, and those the details complete ending in a dimmed `…`.
 */
export const Loading: Story<ThreadAccordionProps> = {
  args: { ...reading, row: overReview, detail: pendingDetail },
};

/** A reply: who wrote the message and when, the message in full, then when the reply began. */
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

/**
 * A closed thread in activity while its details are read: the snapshot
 * holds nothing of it, so the accordion says `loading…`.
 */
export const RestingLoading: Story<ThreadAccordionProps> = {
  args: {
    ...reading,
    clock: false,
    row: {
      repo: "example",
      thread: overReview.wait.thread,
      people: teamSettings.people,
      viewer: "alice",
    },
    detail: pendingDetail,
  },
};

/**
 * Reading is paused, and no details are held: what the snapshot holds,
 * each line that needs the read ending in a dimmed `…`.
 */
export const Paused: Story<ThreadAccordionProps> = {
  args: {
    ...reading,
    row: overReview,
    detail: Promise.resolve(pauseDetail(overReviewDetail)),
  },
};

/** Reading is paused, for a thread the snapshot holds nothing of. */
export const PausedUnheld: Story<ThreadAccordionProps> = {
  args: {
    ...reading,
    row: overReview,
    detail: Promise.resolve({ resumes: new Date("2026-09-28T13:00:00Z") }),
  },
};

/** Reading the details failed: the reason under what the snapshot showed. */
export const Failed: Story<ThreadAccordionProps> = {
  args: {
    ...reading,
    row: overReview,
    detail: failDetail(new Error("GitHub timed out.")),
  },
};

/**
 * The long review, owned by a long login and a team, its checks with long
 * names failing, on a long base branch: more than eight lines hold.
 */
export const Long: Story<ThreadAccordionProps> = {
  args: {
    ...reading,
    row: longSharedReview,
    detail: Promise.resolve(longReviewDetail),
  },
};
