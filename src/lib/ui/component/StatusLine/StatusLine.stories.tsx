import type { Meta, Story } from "../../../../testing/stories.js";
import type { CacheStatus } from "../../../cache/index.js";
import type { ProviderError } from "../../../provider/index.js";
import StatusLine from "./StatusLine.js";
import type { StatusLineProps } from "./types.js";

const meta: Meta<StatusLineProps> = {
  title: "component/StatusLine",
  component: StatusLine,
};

export default meta;

const now = new Date("2026-09-28T12:00:00Z");

/** Synced two minutes ago, with nothing happening. */
const settled: CacheStatus = {
  syncedAt: new Date("2026-09-28T11:58:00Z"),
  refreshing: false,
  whole: false,
  stages: [],
  fullRefreshAvailableAt: undefined,
  paused: undefined,
  failure: undefined,
};

/** A refresh in the background on the second of three repositories. */
const background: CacheStatus = {
  ...settled,
  refreshing: true,
  stages: [
    {
      repo: "example-org/example-repo",
      stage: { kind: "done", threads: 12, fetched: 1, total: 1 },
    },
    { repo: "example-org/example-docs", stage: { kind: "checking" } },
    { repo: "example-org/example-site", stage: { kind: "waiting" } },
  ],
};

const timedOut: ProviderError = Object.assign(
  new Error("GitHub gave no answer within 30 seconds."),
  { code: "GITHUB_TIMED_OUT", recovery: "refresh" } as const,
);

const refused: ProviderError = Object.assign(
  new Error("GitHub refused the request."),
  { code: "GITHUB_REQUEST_FAILED", recovery: "refresh" } as const,
);

/** The live budget figures for 35% left of the budget, which resets at 14:20. */
const low = "budget 35% · resets 14:20";

const base = {
  now,
  timezone: "UTC",
  names: {
    "example-org/example-repo": "example",
    "example-org/example-docs": "docs",
  },
  width: 40,
};

/** How old the data is, dimmed. */
export const Synced: Story<StatusLineProps> = {
  args: { ...base, status: settled },
};

/** GitHub refused requests for its rate limit, until the budget resets. */
export const RateLimited: Story<StatusLineProps> = {
  args: {
    ...base,
    status: {
      ...settled,
      paused: { until: new Date("2026-09-28T14:20:00Z"), reason: "rateLimit" },
    },
  },
};

/** GitHub gave no answer in time; the data shown is from before. */
export const Offline: Story<StatusLineProps> = {
  args: {
    ...base,
    status: {
      ...settled,
      syncedAt: new Date("2026-09-28T10:12:00Z"),
      failure: timedOut,
    },
  },
};

/** GitHub refused the last refresh; the data shown is from before it. */
export const RefreshFailed: Story<StatusLineProps> = {
  args: {
    ...base,
    status: {
      ...settled,
      syncedAt: new Date("2026-09-28T10:12:00Z"),
      failure: refused,
    },
  },
};

/** A full refresh fetching the first repository's pages. */
export const FullRefresh: Story<StatusLineProps> = {
  args: {
    ...base,
    status: {
      ...settled,
      syncedAt: undefined,
      refreshing: true,
      whole: true,
      stages: [
        {
          repo: "example-org/example-repo",
          stage: { kind: "reading", fetched: 5, total: 9 },
        },
        { repo: "example-org/example-docs", stage: { kind: "waiting" } },
      ],
    },
  },
};

/** A refresh in the background, while the data shown stays. */
export const Refreshing: Story<StatusLineProps> = {
  args: { ...base, status: background },
};

/** A full refresh asked for within the cooldown of the last one. */
export const FullRefreshRefused: Story<StatusLineProps> = {
  args: {
    ...base,
    status: {
      ...settled,
      fullRefreshAvailableAt: new Date("2026-09-28T12:00:42Z"),
    },
  },
};

/** The user's own action failed a second ago, over how old the data is. */
export const ActionFailed: Story<StatusLineProps> = {
  args: {
    ...base,
    status: background,
    action: {
      failed: true,
      text: "could not open the browser",
      at: new Date("2026-09-28T11:59:59Z"),
    },
  },
};

/** The user's own action went through a second ago, naming the people it set. */
export const ActionDone: Story<StatusLineProps> = {
  args: {
    ...base,
    status: settled,
    action: {
      failed: false,
      text: "assigned",
      people: [
        { text: "alice", fit: "trimmed", group: "you" },
        { text: "erin", fit: "trimmed", group: "internal" },
      ],
      at: new Date("2026-09-28T11:59:59Z"),
    },
  },
};

/** No key for 20 minutes: the pane refreshes slowly until one wakes it. */
export const Idle: Story<StatusLineProps> = {
  args: {
    ...base,
    status: { ...settled, syncedAt: new Date("2026-09-28T11:35:00Z") },
    attention: "idle",
  },
};

/**
 * Below the budget floor: the list spends no point, nothing is read ahead,
 * and the left side says until when, so the right side stays empty.
 */
export const BudgetPaused: Story<StatusLineProps> = {
  args: {
    ...base,
    liveBudget: "budget 18% · resets 13:00",
    status: {
      ...settled,
      paused: { until: new Date("2026-09-28T13:00:00Z"), reason: "budget" },
    },
  },
};

/** Less than 40% of the queries' budget left: how much, and when it resets, dimmed. */
export const BudgetLow: Story<StatusLineProps> = {
  args: { ...base, status: settled, liveBudget: low },
};

/** The budget low while details are read: the count takes the right side. */
export const BudgetLowWithDetails: Story<StatusLineProps> = {
  args: {
    ...base,
    status: settled,
    liveBudget: low,
    details: { read: 0, asked: 12 },
  },
};

/** No cache: gh is missing or not signed in. */
export const Blank: Story<StatusLineProps> = {
  args: base,
};

/** The details near the selection being read, how old the data is on the left. */
export const DetailsLoading: Story<StatusLineProps> = {
  args: { ...base, status: settled, details: { read: 0, asked: 12 } },
};

/** A refresh in the background, and the details read so far. */
export const RefreshingWithDetails: Story<StatusLineProps> = {
  args: { ...base, status: background, details: { read: 3, asked: 12 } },
};

/**
 * A key woke the pane: it catches up at once, and reads again the whole
 * window of details around the selection.
 */
export const Waking: Story<StatusLineProps> = {
  args: {
    ...base,
    status: {
      ...background,
      stages: [
        { repo: "example-org/example-repo", stage: { kind: "checking" } },
        { repo: "example-org/example-docs", stage: { kind: "waiting" } },
        { repo: "example-org/example-site", stage: { kind: "waiting" } },
      ],
    },
    attention: "waking",
    details: { read: 0, asked: 12 },
  },
};
