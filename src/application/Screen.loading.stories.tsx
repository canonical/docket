import type { CacheStatus } from "../lib/cache/index.js";
import type { ProviderError } from "../lib/provider/index.js";
import {
  ScreenFrame,
  type ScreenFrameProps,
  settled,
  viewRecording,
} from "../testing/screen.js";
import type { Meta, Story } from "../testing/stories.js";
import createDetailReader from "./createDetailReader.js";

/** The composed screen while its data loads, or waits to. */
const meta: Meta<ScreenFrameProps> = {
  title: "application/Screen/loading",
  component: ScreenFrame,
};

export default meta;

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";

/** A first run that stopped: nothing synced, nothing refreshing. */
const stopped = (
  stages: CacheStatus["stages"],
  change: Partial<CacheStatus>,
): ScreenFrameProps =>
  viewRecording({
    status: { ...settled, syncedAt: undefined, stages, ...change },
    threads: [],
  });

/** The first run paused for the budget after the first repository. */
export const FirstRunPaused: Story<ScreenFrameProps> = {
  args: stopped(
    [
      { repo, stage: { kind: "done", threads: 2, fetched: 1, total: 1 } },
      { repo: docs, stage: { kind: "paused", reason: "budget" } },
    ],
    {
      paused: {
        until: new Date("2026-09-28T14:20+02:00"),
        reason: "budget",
      },
    },
  ),
};

/** GitHub refused the first run for its rate limit on the second repository. */
export const FirstRunRateLimited: Story<ScreenFrameProps> = {
  args: stopped(
    [
      { repo, stage: { kind: "done", threads: 2, fetched: 1, total: 1 } },
      { repo: docs, stage: { kind: "paused", reason: "rateLimit" } },
    ],
    {
      paused: {
        until: new Date("2026-09-28T14:20+02:00"),
        reason: "rateLimit",
      },
    },
  ),
};

const timedOut: ProviderError = Object.assign(
  new Error("GitHub gave no answer within 30 seconds."),
  { code: "GITHUB_TIMED_OUT", recovery: "refresh" } as const,
);

/** The first run failed on the second repository: its reason, then the step. */
export const FirstRunFailed: Story<ScreenFrameProps> = {
  args: stopped(
    [
      { repo, stage: { kind: "done", threads: 2, fetched: 1, total: 1 } },
      { repo: docs, stage: { kind: "failed", error: timedOut } },
    ],
    { failure: timedOut },
  ),
};

/** A reader of details ahead that never hears back, so every one stays unread. */
const unanswered = () =>
  createDetailReader(
    () => new Promise(() => {}),
    () => false,
  );

/** The details near the selection being read: none of them yet. */
export const DetailsLoading: Story<ScreenFrameProps> = {
  args: viewRecording({ details: unanswered() }),
};

/** A background refresh on the list's side, the details being read on the other. */
export const RefreshingWithDetails: Story<ScreenFrameProps> = {
  args: viewRecording({
    details: unanswered(),
    status: {
      ...settled,
      refreshing: true,
      stages: [
        {
          repo,
          stage: { kind: "done", threads: 2, fetched: 0, total: 0 },
        },
        { repo: docs, stage: { kind: "checking" } },
      ],
    },
  }),
};
