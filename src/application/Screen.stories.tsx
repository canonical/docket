import { useKeymap } from "@opentui/keymap/react";
import { type ReactNode, useEffect } from "react";
import type { CacheStatus } from "../lib/cache/index.js";
import type { ProviderError, ThreadDetail } from "../lib/provider/index.js";
import type { Thread, ThreadSummary } from "../lib/waits/index.js";
import { holdCache, settleStatus } from "../testing/cache.js";
import { everyCapability } from "../testing/provider.js";
import {
  parserFixDetail,
  recordedEvents,
  recordedNow,
  recordedSettings,
  recordedThreads,
  recordedWatched,
} from "../testing/recorded.js";
import type { Meta, Story } from "../testing/stories.js";
import { WithKeys } from "../testing/terminal.js";
import Screen from "./Screen.js";
import type { TerminalView } from "./types.js";

/** The screen as it opens on `view`, with `run` run once it has. */
interface ScreenFrameProps extends TerminalView {
  /** Commands of the screen's key layer, run in order once it opens. */
  readonly run?: readonly string[];
}

/** Runs `commands` through the keymap once, as their keys would. */
function RunOnOpen({ commands }: { readonly commands: readonly string[] }) {
  const keymap = useKeymap();
  useEffect(() => {
    for (const command of commands) keymap.runCommand(command);
  }, [keymap, commands]);
  return null;
}

/**
 * The terminal interface's one screen, with the keymap it binds its keys
 * through: the screen `openTerminal` opens, drawn from a cache held still.
 */
function ScreenFrame({ run = [], ...view }: ScreenFrameProps): ReactNode {
  return (
    <WithKeys>
      <Screen {...view} onQuit={() => {}} />
      <RunOnOpen commands={run} />
    </WithKeys>
  );
}

const meta: Meta<ScreenFrameProps> = {
  title: "application/Screen",
  component: ScreenFrame,
};

export default meta;

const settled = settleStatus(recordedNow);

/**
 * Every thread's details, with the thread's own age, labels and assignees.
 * The held cache gives only recorded threads, so any other is a mistake.
 */
const readDetail = async (thread: ThreadSummary): Promise<ThreadDetail> => {
  const facts = recordedThreads.find(
    ({ repo, number }) => repo === thread.repo && number === thread.number,
  );
  if (!facts) throw new Error(`#${thread.number} is not recorded`);
  const { createdAt, labels, assignees } = facts;
  return { ...parserFixDetail, createdAt, labels, assignees };
};

/** No frame opens an editor, so nothing reads whom it offers or writes. */
const refuseEditor = (): never => {
  throw new Error("no frame opens an editor");
};

/**
 * owed as it opens on the recording, with the cache's `status` and
 * `threads`, and the accordion's details read by `read`.
 */
function viewRecording({
  status = settled,
  threads = recordedThreads,
  read = readDetail,
}: {
  readonly status?: CacheStatus;
  readonly threads?: readonly Thread[];
  readonly read?: (thread: ThreadSummary) => Promise<ThreadDetail>;
} = {}): TerminalView {
  const cache = holdCache(
    { threads, syncedAt: status.syncedAt },
    status,
    recordedEvents,
  );
  return {
    mode: "owed",
    owedGrouping: "none",
    now: () => recordedNow,
    openInBrowser: async () => {},
    settings: recordedSettings,
    watched: recordedWatched(),
    source: {
      cache,
      capabilities: everyCapability,
      readWatched: async () => ({ watched: recordedWatched() }),
      readDetail: read,
      readEvents: (repo, since) => cache.readEvents(repo, since, 300_000),
      readCandidates: refuseEditor,
      write: refuseEditor,
    },
  };
}

const recording = viewRecording();

/** owed, no grouping: the first row selected, with its accordion open. */
export const Owed: Story<ScreenFrameProps> = { args: recording };

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
      fullRefresh: {
        repo: "example-org/example-docs",
        position: 2,
        count: 2,
        fetched: 5,
        total: 9,
      },
    },
    threads: [],
  }),
};

/** A refresh in the background: the rows stay, the status line says so. */
export const Refreshing: Story<ScreenFrameProps> = {
  args: viewRecording({ status: { ...settled, refreshing: true } }),
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

const timedOut: ProviderError = Object.assign(
  new Error("GitHub gave no answer within 30 seconds."),
  { code: "GITHUB_TIMED_OUT", recovery: "refresh" } as const,
);

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
