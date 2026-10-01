import {
  failDetail,
  overReviewDetail,
  pauseDetail,
  pendingDetail,
  sharedCloseDetail,
  soonReplyDetail,
} from "../../../../testing/details.js";
import { teamSettings } from "../../../../testing/facts.js";
import { findFinishedRow } from "../../../../testing/finished.js";
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

/**
 * A finished issue that ended past its target: what line 1 does not say
 * of its time to close, then its labels, the bar running on to its ending.
 */
export const FinishedOver: Story<ThreadAccordionProps> = {
  args: {
    ...reading,
    row: findFinishedRow("example#7"),
    detail: Promise.resolve(overReviewDetail),
  },
};

/** A finished issue that a pull request closed, within its target: the target, then what closed it. */
export const FinishedClosedIn: Story<ThreadAccordionProps> = {
  args: {
    ...reading,
    row: findFinishedRow("docs#4"),
    detail: Promise.resolve(overReviewDetail),
  },
};

/**
 * A finished pull request in a stack while its details are read: every
 * line from the list at once, the stack's neighbours ending in a dimmed `…`.
 */
export const FinishedStackLoading: Story<ThreadAccordionProps> = {
  args: {
    ...reading,
    row: findFinishedRow("example#2"),
    detail: pendingDetail,
  },
};

/**
 * Reading is paused for a finished pull request in a stack: every line
 * from the list, and its stack's neighbours saying when reading resumes.
 */
export const FinishedPaused: Story<ThreadAccordionProps> = {
  args: {
    ...reading,
    row: findFinishedRow("example#2"),
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
