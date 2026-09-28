import { useKeymap } from "@opentui/keymap/react";
import { type ReactNode, useEffect, useState } from "react";
import type { CacheStatus } from "../lib/cache/index.js";
import type {
  Provider,
  ProviderError,
  ThreadDetail,
} from "../lib/provider/index.js";
import type { Thread, ThreadSummary } from "../lib/waits/index.js";
import { holdCache, settleStatus } from "../testing/cache.js";
import { alice, bob, carol } from "../testing/facts.js";
import { everyCapability } from "../testing/provider.js";
import {
  parserFixDetail,
  recordedEvents,
  recordedNow,
  recordedProvider,
  recordedSettings,
  recordedThreads,
  recordedWatched,
} from "../testing/recorded.js";
import type { Meta, Story } from "../testing/stories.js";
import { WithKeys } from "../testing/terminal.js";
import readCandidates from "./readCandidates.js";
import Screen from "./Screen.js";
import type { TerminalView } from "./types.js";
import writeFromTerminal from "./writeFromTerminal.js";

/** The source of a view that gh gives a token for. */
type Connected = Extract<TerminalView["source"], { readonly cache: unknown }>;

/** The screen as it opens on `view`, with `run` run once it has. */
interface ScreenFrameProps extends TerminalView {
  /** Commands of the screen's key layer, run in order once it opens. */
  readonly run?: readonly string[];
  /**
   * Makes the view's source anew for each drawing, in place of `source`,
   * so what one drawing writes never reaches the next.
   */
  readonly connect?: () => Connected;
}

/**
 * `source`, and a `settle` that waits until every read of whom an editor
 * offers, and every write one has begun, has its answer.
 */
function watchSource(source: TerminalView["source"]) {
  const pending = new Set<Promise<unknown>>();
  const watch = <T,>(answer: Promise<T>): Promise<T> => {
    pending.add(answer);
    const done = () => {
      pending.delete(answer);
    };
    answer.then(done, done);
    return answer;
  };
  const settle = async () => {
    while (pending.size > 0) await Promise.allSettled([...pending]);
  };
  if (!("cache" in source)) return { source, settle };
  const watched: Connected = {
    ...source,
    readCandidates: (action, thread) =>
      watch(source.readCandidates(action, thread)),
    write: (request) => watch(source.write(request)),
  };
  return { source: watched, settle };
}

/**
 * Runs `commands` through the keymap, as their keys would, one at a time:
 * each runs once the screen has drawn the one before it and `settle` says
 * GitHub has answered what it asked, as a person waits to see a key's
 * answer before pressing the next. Every step is work React holds, so the
 * drawing is taken only once the last has run.
 */
function RunOnOpen({
  commands,
  settle,
}: {
  readonly commands: readonly string[];
  readonly settle: () => Promise<void>;
}) {
  const keymap = useKeymap();
  const [step, setStep] = useState(0);
  useEffect(() => {
    const command = commands.at(step);
    if (command === undefined) return;
    keymap.runCommand(command);
    void settle().then(() => setStep(step + 1));
  }, [keymap, commands, settle, step]);
  return null;
}

/**
 * The terminal interface's one screen, with the keymap it binds its keys
 * through: the screen `openTerminal` opens, drawn from a cache held still.
 */
function ScreenFrame({
  run = [],
  connect,
  ...view
}: ScreenFrameProps): ReactNode {
  const [{ source, settle }] = useState(() =>
    watchSource(connect?.() ?? view.source),
  );
  return (
    <WithKeys>
      <Screen {...view} source={source} onQuit={() => {}} />
      <RunOnOpen commands={run} settle={settle} />
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

/** A frame given no stand-in for GitHub opens no editor, so reads and writes nothing. */
const refuseEditor = (): never => {
  throw new Error("this frame opens no editor");
};

/** `example-org/example-repo#12`, the key a thread is found by. */
const nameThread = ({ repo, number }: Pick<Thread, "repo" | "number">) =>
  `${repo}#${number}`;

/**
 * A stand-in for GitHub, in memory, that holds the recording's threads as
 * the editors read and write them: alice, bob and carol can be assigned,
 * and a set given to it is recorded without anyone else in it, as GitHub
 * records it. Nothing it is given leaves the process.
 */
function standInGitHub(): Provider {
  const assignable = [alice, bob, carol];
  const assignees = new Map(
    recordedThreads.map((thread) => [nameThread(thread), thread.assignees]),
  );
  // Only the recording's threads reach the stand-in, so any other is a mistake.
  const findAssignees = (thread: Pick<Thread, "repo" | "number">) => {
    const held = assignees.get(nameThread(thread));
    if (!held) throw new Error(`#${thread.number} is not recorded`);
    return held;
  };
  return recordedProvider({
    snapshot: async (repo) => ({
      threads: recordedThreads
        .filter((thread) => thread.repo === repo)
        .map((thread) => ({
          ...thread,
          assignees: findAssignees(thread),
        })),
      cursor: null,
    }),
    assignableUsers: async () => assignable,
    readAssignees: async (thread) => findAssignees(thread),
    setAssignees: async (thread, logins) => {
      const recorded = assignable.filter(({ login }) => logins.includes(login));
      assignees.set(nameThread(thread), recorded);
      return recorded;
    },
  });
}

/**
 * The recording's source, with the cache's `status` and `threads`, the
 * accordion's details read by `read`, and the editors reading and writing
 * `github`, when one is given.
 */
function connectRecording({
  status = settled,
  threads = recordedThreads,
  read = readDetail,
  github,
}: {
  readonly status?: CacheStatus;
  readonly threads?: readonly Thread[];
  readonly read?: (thread: ThreadSummary) => Promise<ThreadDetail>;
  readonly github?: Provider;
} = {}): Connected {
  const cache = holdCache(
    { threads, syncedAt: status.syncedAt },
    status,
    recordedEvents,
    github,
  );
  return {
    cache,
    capabilities: everyCapability,
    readWatched: async () => ({ watched: recordedWatched() }),
    readViewer: async () => "alice",
    readDetail: read,
    readEvents: (repo, since) => cache.readEvents(repo, since, 300_000),
    readCandidates: github
      ? (action, thread) => readCandidates(github, action, thread)
      : refuseEditor,
    write: github
      ? (request) => writeFromTerminal({ provider: github, cache }, request)
      : refuseEditor,
  };
}

/** owed as it opens on the recording, its source as `connectRecording` gives it. */
function viewRecording(
  options: Parameters<typeof connectRecording>[0] = {},
): TerminalView {
  return {
    mode: "owed",
    owedGrouping: "none",
    now: () => recordedNow,
    openInBrowser: async () => {},
    settings: recordedSettings,
    watched: recordedWatched(),
    source: connectRecording(options),
  };
}

const recording = viewRecording();

/** The recording, its editors on a stand-in for GitHub made anew for each drawing. */
const editable: ScreenFrameProps = {
  ...recording,
  connect: () => connectRecording({ github: standInGitHub() }),
};

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

/**
 * `a` on the reply row: the editor under it, alice ticked as GitHub holds
 * her, then the team, the people who wrote on the thread and everyone else
 * GitHub can assign, the cursor on carol, whom only GitHub offers.
 */
export const AssignEditor: Story<ScreenFrameProps> = {
  args: {
    ...editable,
    run: ["thread.assign", "editor.next", "editor.next", "editor.next"],
  },
};

/**
 * `r` on the review row: bob ticked as asked, then whom GitHub suggests,
 * the collaborators and the team, the cursor on the team.
 */
export const RequestReviewEditor: Story<ScreenFrameProps> = {
  args: {
    ...editable,
    run: [
      "selection.next",
      "selection.next",
      "selection.next",
      "selection.next",
      "thread.review",
      "editor.next",
      "editor.next",
      "editor.next",
    ],
  },
};

/**
 * dave ticked beside alice and applied: GitHub cannot assign him and
 * records alice alone, so the editor stays open with the reason and a
 * Recovery line, and the status line says the assignment was refused.
 */
export const AssignRefused: Story<ScreenFrameProps> = {
  args: {
    ...editable,
    run: [
      "thread.assign",
      "editor.next",
      "editor.next",
      "editor.toggle",
      "editor.apply",
    ],
  },
};

/**
 * carol ticked beside alice and applied: the editor closes, the row reads
 * both, and the status line says whom GitHub assigned.
 */
export const AssignSucceeded: Story<ScreenFrameProps> = {
  args: {
    ...editable,
    run: [
      "thread.assign",
      "editor.next",
      "editor.next",
      "editor.next",
      "editor.toggle",
      "editor.apply",
    ],
  },
};
