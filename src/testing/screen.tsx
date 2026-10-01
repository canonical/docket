/**
 * The composed screen as its stories draw it: the screen `openTerminal`
 * opens, with its keymap, on the recording held still, and the keys a
 * story presses run once it opens.
 */
import { useKeymap } from "@opentui/keymap/react";
import { type ReactNode, useEffect, useState } from "react";
import type { DetailReader } from "../application/createDetailReader.js";
import readCandidates from "../application/readCandidates.js";
import Screen from "../application/Screen.js";
import type { TerminalView } from "../application/types.js";
import writeFromTerminal from "../application/writeFromTerminal.js";
import type { CacheStatus } from "../lib/cache/index.js";
import type { FinishedThread } from "../lib/endings/index.js";
import type { Provider, ThreadDetail } from "../lib/provider/index.js";
import type { Thread, ThreadSummary } from "../lib/waits/index.js";
import { holdCache, settleStatus } from "./cache.js";
import { alice, bob, carol } from "./facts.js";
import { everyCapability } from "./provider.js";
import {
  parserFixDetail,
  recordedEvents,
  recordedNow,
  recordedProvider,
  recordedSettings,
  recordedThreads,
  recordedWatched,
} from "./recorded.js";
import { WithKeys } from "./terminal.js";

/** The source of a view that gh gives a token for. */
type Connected = Extract<TerminalView["source"], { readonly cache: unknown }>;

/** The screen as it opens on `view`, with `run` run once it has. */
export interface ScreenFrameProps extends TerminalView {
  /** Commands of the screen's key layer, run in order once it opens. */
  readonly run?: readonly string[];
  /**
   * Makes the view's source anew for each drawing, in place of `source`,
   * so what one drawing writes never reaches the next.
   */
  readonly connect?: () => Connected;
}

/**
 * `source`, and a `settle` that waits until every read of a window's
 * events, every read of whom an editor offers, and every write one has
 * begun, has its answer.
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
    readEvents: (repo, since) => watch(source.readEvents(repo, since)),
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
export function ScreenFrame({
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

export const settled = settleStatus(recordedNow);

/**
 * Reads each of `threads`' details, with the thread's own age, labels and
 * assignees. The held cache gives only those threads, so any other is a
 * mistake.
 */
const readDetail =
  (threads: readonly Thread[]) =>
  async (thread: ThreadSummary): Promise<ThreadDetail> => {
    const facts = threads.find(
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
export function standInGitHub(): Provider {
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
 * The recording's source, with the cache's `status`, `threads` and
 * `finished` threads, the accordion's details read by `read`, details
 * read ahead by `details`, and the editors reading and writing `github`,
 * when each is given.
 */
export function connectRecording({
  status = settled,
  threads = recordedThreads,
  read = readDetail(threads),
  details,
  github,
  finished = [],
}: {
  readonly status?: CacheStatus;
  readonly threads?: readonly Thread[];
  readonly read?: (thread: ThreadSummary) => Promise<ThreadDetail>;
  readonly details?: DetailReader;
  readonly github?: Provider;
  readonly finished?: readonly FinishedThread[];
} = {}): Connected {
  const cache = holdCache(
    { threads, syncedAt: status.syncedAt },
    status,
    recordedEvents,
    github,
    finished,
  );
  return {
    cache,
    capabilities: everyCapability,
    readWatched: async () => ({ watched: recordedWatched() }),
    readViewer: async () => "alice",
    readDetail: read,
    ...(details && { details }),
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
export function viewRecording(
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
