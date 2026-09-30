import type { ProviderError, ThreadDetail } from "../lib/provider/index.js";
import type { Thread } from "../lib/waits/index.js";
import { at, bob, exampleSync } from "../testing/facts.js";
import {
  crash,
  parserFix,
  parserFixDetail,
  recordedSettings,
  recordedThreads,
  recordedWatched,
  yourTeamSettings,
} from "../testing/recorded.js";
import {
  connectRecording,
  ScreenFrame,
  type ScreenFrameProps,
  settled,
  viewRecording,
} from "../testing/screen.js";
import type { Meta, Story } from "../testing/stories.js";

const meta: Meta<ScreenFrameProps> = {
  title: "application/Screen",
  component: ScreenFrame,
};

export default meta;

const recording = viewRecording();

const timedOut: ProviderError = Object.assign(
  new Error("GitHub gave no answer within 30 seconds."),
  { code: "GITHUB_TIMED_OUT", recovery: "refresh" } as const,
);

/** owed, no grouping: the first row selected, with its accordion open. */
export const Owed: Story<ScreenFrameProps> = { args: recording };

const teamless = { ...recordedSettings, people: new Map() };

/** owed while no team is listed: every comment waits, and a notice says so. */
export const OwedNoTeam: Story<ScreenFrameProps> = {
  args: {
    ...recording,
    settings: teamless,
    watched: recordedWatched(teamless),
    source: {
      ...connectRecording(),
      readWatched: async () => ({
        watched: recordedWatched(teamless),
      }),
    },
  },
};

/** The selection one row down, its accordion open under it. */
export const OwedSecondSelected: Story<ScreenFrameProps> = {
  args: { ...recording, run: ["selection.next"] },
};

/** A review row selected, its review accordion open under it. */
export const OwedReviewSelected: Story<ScreenFrameProps> = {
  args: {
    ...recording,
    run: [
      "selection.next",
      "selection.next",
      "selection.next",
      "selection.next",
    ],
  },
};

/** owed by owner: owners alphabetically, unassigned last. */
export const OwedByOwner: Story<ScreenFrameProps> = {
  args: { ...recording, owedGrouping: "owner" },
};

/** owed by repo, in the configuration's order, the accordion still loading. */
export const OwedByRepo: Story<ScreenFrameProps> = {
  args: {
    ...viewRecording({ read: () => new Promise<ThreadDetail>(() => {}) }),
    owedGrouping: "repo",
  },
};

/** owed by stack: the stack's section, then what is in no stack. */
export const OwedByStack: Story<ScreenFrameProps> = {
  args: { ...recording, owedGrouping: "stack" },
};

/**
 * owed by stack, the stacked reply selected and its details failed: the
 * reason under what the snapshot showed, the stack mark down every line.
 */
export const OwedByStackFailed: Story<ScreenFrameProps> = {
  args: {
    ...viewRecording({ read: async () => Promise.reject(timedOut) }),
    owedGrouping: "stack",
  },
};

/**
 * The reply carol is waiting on selected, the message she opened with
 * under it: she is in the organisation but not on the team, under items
 * alice owes, each person in their group's mark and hue, and each
 * two-line item's bar ending on its second line.
 */
export const OwedOrganisationReply: Story<ScreenFrameProps> = {
  args: {
    ...viewRecording({
      threads: recordedThreads.map((thread) =>
        thread === crash
          ? {
              ...crash,
              text: "The app closes as soon as it opens, since the last update to the settings file.",
            }
          : thread,
      ),
    }),
    run: ["selection.next", "selection.next"],
  },
};

/** A dependency update a bot opened, asking bob for a review. */
const botUpdate: Thread = {
  ...parserFix,
  number: 20,
  url: "https://github.com/example-org/example-repo/pull/20",
  title: "Update dependency zod to 3.24",
  stack: undefined,
  author: exampleSync,
  createdAt: at("2026-09-26T08:00+02:00"),
  updatedAt: at("2026-09-26T08:00+02:00"),
  labels: ["dependencies"],
  assignees: [],
  comments: [],
  reviewRequests: [
    {
      reviewer: bob,
      requester: exampleSync,
      at: at("2026-09-26T08:00+02:00"),
    },
  ],
  checks: "passing",
};

/** What GitHub gives for the update: two files changed and every check passed. */
const botUpdateDetail: ThreadDetail = {
  createdAt: botUpdate.createdAt,
  updatedAt: botUpdate.updatedAt,
  labels: botUpdate.labels,
  assignees: [],
  messages: [],
  requests: [
    { reviewer: bob, requester: exampleSync, at: botUpdate.createdAt },
  ],
  files: [
    { path: "package.json", additions: 1, deletions: 1 },
    { path: "bun.lock", additions: 3, deletions: 3 },
  ],
  checks: [
    { name: "lint", state: "passing" },
    { name: "test", state: "passing" },
    { name: "build", state: "passing" },
  ],
};

/** The settings, with dependency updates kept off the close clock. */
const updatesExempt = {
  ...recordedSettings,
  exempt: { close: ["dependencies"] },
};

/**
 * A thread a bot opened, selected: its author and whoever asked for the
 * review behind the bot's mark, dimmed, the review still one bob owes.
 */
export const OwedBotAuthored: Story<ScreenFrameProps> = {
  args: {
    ...recording,
    settings: updatesExempt,
    watched: recordedWatched(updatesExempt),
    source: {
      ...connectRecording({
        threads: [...recordedThreads, botUpdate],
        read: async (thread) =>
          thread.number === botUpdate.number
            ? botUpdateDetail
            : parserFixDetail,
      }),
      readWatched: async () => ({
        watched: recordedWatched(updatesExempt),
      }),
    },
    run: [
      "selection.next",
      "selection.next",
      "selection.next",
      "selection.next",
    ],
  },
};

/** activity over 24 working hours, by kind: the thread's state above its events. */
export const ActivityByKind: Story<ScreenFrameProps> = {
  args: {
    ...recording,
    mode: "activity",
    activity: { window: { amount: 24, unit: "h" }, grouping: "kind" },
  },
};

/** activity over 72 working hours, by repo. */
export const ActivityByRepo: Story<ScreenFrameProps> = {
  args: {
    ...recording,
    mode: "activity",
    activity: { window: { amount: 72, unit: "h" }, grouping: "repo" },
  },
};

/** activity over 72 working hours with no grouping, newest first. */
export const ActivityUngrouped: Story<ScreenFrameProps> = {
  args: {
    ...recording,
    mode: "activity",
    activity: { window: { amount: 72, unit: "h" }, grouping: "none" },
  },
};

/** Nothing owed: the empty state, the counts at zero, the freshness. */
export const NothingOwed: Story<ScreenFrameProps> = {
  args: viewRecording({ threads: [] }),
};

/** The first run: nothing cached, the full refresh's progress. */
export const FirstRun: Story<ScreenFrameProps> = {
  args: viewRecording({
    status: {
      ...settled,
      syncedAt: undefined,
      refreshing: true,
      whole: true,
      stages: [
        {
          repo: "example-org/example-repo",
          stage: { kind: "done", threads: 2, fetched: 1, total: 1 },
        },
        {
          repo: "example-org/example-docs",
          stage: { kind: "reading", fetched: 5, total: 9 },
        },
      ],
    },
    threads: [],
  }),
};

/** A refresh in the background: the rows stay, the status line says so. */
export const Refreshing: Story<ScreenFrameProps> = {
  args: viewRecording({
    status: {
      ...settled,
      refreshing: true,
      stages: [
        {
          repo: "example-org/example-repo",
          stage: { kind: "done", threads: 2, fetched: 1, total: 1 },
        },
        { repo: "example-org/example-docs", stage: { kind: "checking" } },
      ],
    },
  }),
};

/** GitHub refused requests for its rate limit: the rows stay. */
export const RateLimited: Story<ScreenFrameProps> = {
  args: viewRecording({
    status: {
      ...settled,
      paused: {
        until: new Date("2026-09-28T14:20+02:00"),
        reason: "rateLimit",
      },
    },
  }),
};
/** No answer from GitHub: the rows stay, with how old they are. */
export const Offline: Story<ScreenFrameProps> = {
  args: viewRecording({
    status: {
      ...settled,
      syncedAt: new Date("2026-09-28T10:12+02:00"),
      failure: timedOut,
    },
  }),
};

/** A full refresh asked for within the cooldown of the last one. */
export const FullRefreshRefused: Story<ScreenFrameProps> = {
  args: viewRecording({
    status: {
      ...settled,
      fullRefreshAvailableAt: new Date("2026-09-28T12:00:42+02:00"),
    },
  }),
};

/** gh is not installed: the reason and the recovery stand in for the list. */
export const GhNotInstalled: Story<ScreenFrameProps> = {
  args: {
    ...recording,
    watched: [],
    source: {
      problem: {
        code: "GH_NOT_INSTALLED",
        message: "docket needs the GitHub CLI (gh).",
        recovery:
          "install it from https://cli.github.com, then run gh auth login",
      },
    },
  },
};

/** gh is not signed in: the reason and the recovery stand in for the list. */
export const GhNotSignedIn: Story<ScreenFrameProps> = {
  args: {
    ...recording,
    watched: [],
    source: {
      problem: {
        code: "GH_NOT_SIGNED_IN",
        message: "gh is not signed in to github.com.",
        recovery: "run gh auth login",
      },
    },
  },
};

/** The help, open over all but the header. */
export const Help: Story<ScreenFrameProps> = {
  args: { ...recording, run: ["help.toggle"] },
};

/** The pull request to fix the parser, its review also asked of alice's team. */
const askedOfYourTeam = recordedThreads.map((thread) =>
  thread === parserFix
    ? {
        ...parserFix,
        reviewRequests: [
          ...parserFix.reviewRequests,
          {
            reviewer: { team: "example-org/reviewers", members: [] },
            requester: bob,
            at: at("2026-09-28T09:00+02:00"),
          },
        ],
      }
    : thread,
);

/**
 * owed by owner while the personal file names example-org/reviewers as
 * alice's team: its heading and its row take her mark, though docket
 * never read its members.
 */
export const OwedByOwnerYourTeam: Story<ScreenFrameProps> = {
  args: {
    ...viewRecording({ threads: askedOfYourTeam }),
    owedGrouping: "owner",
    settings: yourTeamSettings,
    watched: recordedWatched(yourTeamSettings),
    source: {
      ...connectRecording({ threads: askedOfYourTeam }),
      readWatched: async () => ({
        watched: recordedWatched(yourTeamSettings),
      }),
    },
  },
};
