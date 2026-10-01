import {
  failDetail,
  overReviewDetail,
  pauseDetail,
  pendingDetail,
  sharedCloseDetail,
  soonReplyDetail,
  timedOut,
} from "../../../../testing/details.js";
import { teamSettings } from "../../../../testing/facts.js";
import { findFinishedRow } from "../../../../testing/finished.js";
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
  clock: true as const,
  now: recordedNow,
  timezone: "Europe/Paris",
  width: 40,
};

/** What a finished thread's accordion reads with: its bar is its verdict, so no clock. */
const { clock: _, ...underFinished } = reading;

/** A review on a stacked pull request: who asked, what changed, the checks, the stack. */
export const Review = {
  args: {
    ...reading,
    row: overReview,
    detail: Promise.resolve(overReviewDetail),
  },
} satisfies Story<ThreadAccordionProps>;

/**
 * The same review while its details are read: the snapshot's lines at
 * once, and those the details complete ending in a dimmed `…`.
 */
export const Loading = {
  args: { ...reading, row: overReview, detail: pendingDetail },
} satisfies Story<ThreadAccordionProps>;

/** A reply: who wrote the message and when, the message in full, then when the reply began. */
export const Reply = {
  args: {
    ...reading,
    row: soonReply,
    detail: Promise.resolve(soonReplyDetail),
  },
} satisfies Story<ThreadAccordionProps>;

/** A close: the age and owners, the last activity, the labels decoded. */
export const Close = {
  args: {
    ...reading,
    row: sharedClose,
    detail: Promise.resolve(sharedCloseDetail),
  },
} satisfies Story<ThreadAccordionProps>;

/**
 * A closed thread in activity while its details are read: the snapshot
 * holds nothing of it, so the accordion says `loading…`.
 */
export const RestingLoading = {
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
} satisfies Story<ThreadAccordionProps>;

/**
 * Reading is paused, and no details are held: what the snapshot holds,
 * each line that needs the read ending in a dimmed `…`.
 */
export const Paused = {
  args: {
    ...reading,
    row: overReview,
    detail: Promise.resolve(pauseDetail(overReviewDetail)),
  },
} satisfies Story<ThreadAccordionProps>;

/** Reading is paused, for a thread the snapshot holds nothing of. */
export const PausedUnheld = {
  args: {
    ...reading,
    row: overReview,
    detail: Promise.resolve({ resumes: new Date("2026-09-28T13:00:00Z") }),
  },
} satisfies Story<ThreadAccordionProps>;

/**
 * A finished issue that ended past its target: what line 1 does not say
 * of its time to close, then its labels, the bar running on to its ending.
 */
export const FinishedOver = {
  args: { ...underFinished, row: findFinishedRow("example#7") },
} satisfies Story<ThreadAccordionProps>;

/** A finished issue that a pull request closed, within its target: the target, then what closed it. */
export const FinishedClosedIn = {
  args: { ...underFinished, row: findFinishedRow("docs#4") },
} satisfies Story<ThreadAccordionProps>;

/**
 * A finished pull request in a stack while its details are read: every
 * line from the list at once, the stack's neighbours ending in a dimmed `…`.
 */
export const FinishedStackLoading = {
  args: {
    ...underFinished,
    row: findFinishedRow("example#2"),
    detail: pendingDetail,
  },
} satisfies Story<ThreadAccordionProps>;

/**
 * Reading the details failed: the reason and its recovery, wrapped, under
 * what the snapshot showed.
 */
export const Failed = {
  args: {
    ...reading,
    row: overReview,
    detail: failDetail(timedOut),
  },
} satisfies Story<ThreadAccordionProps>;

/**
 * The long review, owned by a long login and a team, its checks with long
 * names failing, on a long base branch: more than eight lines hold.
 */
export const Long = {
  args: {
    ...reading,
    row: longSharedReview,
    detail: Promise.resolve(longReviewDetail),
  },
} satisfies Story<ThreadAccordionProps>;
