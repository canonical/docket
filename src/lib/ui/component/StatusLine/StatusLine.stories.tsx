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
  fullRefresh: undefined,
  fullRefreshAvailableAt: undefined,
  paused: undefined,
  failure: undefined,
};

const timedOut: ProviderError = Object.assign(
  new Error("GitHub gave no answer within 30 seconds."),
  { code: "GITHUB_TIMED_OUT", recovery: "refresh" } as const,
);

const refused: ProviderError = Object.assign(
  new Error("GitHub refused the request."),
  { code: "GITHUB_REQUEST_FAILED", recovery: "refresh" } as const,
);

const base = {
  now,
  timezone: "UTC",
  names: { "example-org/example-repo": "example" },
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
      fullRefresh: {
        repo: "example-org/example-repo",
        position: 1,
        count: 2,
        fetched: 5,
        total: 9,
      },
    },
  },
};

/** A refresh in the background, while the data shown stays. */
export const Refreshing: Story<StatusLineProps> = {
  args: { ...base, status: { ...settled, refreshing: true } },
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

/** No cache: gh is missing or not signed in. */
export const Blank: Story<StatusLineProps> = {
  args: base,
};
