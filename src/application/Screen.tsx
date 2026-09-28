import { useBindings } from "@opentui/keymap/react";
import { useTerminalDimensions } from "@opentui/react";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  activityGroupings,
  describeAddress as describeActivityAddress,
} from "../lib/activity/index.js";
import type { CacheStatus } from "../lib/cache/index.js";
import {
  describeAddress as describeOwedAddress,
  owedGroupings,
  type WaitRow,
} from "../lib/owed/index.js";
import type { ThreadDetail } from "../lib/provider/index.js";
import { tokens } from "../lib/tokens/index.js";
import {
  CountsLine,
  describeClock,
  EmptyState,
  HelpOverlay,
  KeyBar,
  Notice,
  Pane,
  PaneHeader,
  ProgressLine,
  StatusLine,
  useCommands,
} from "../lib/ui/index.js";
import buildOwed from "./buildOwed.js";
import identifyRow from "./identifyRow.js";
import OwedList from "./OwedList.js";
import placeSelection, { type Selection } from "./placeSelection.js";
import type { TerminalMode, TerminalView, WatchedFiles } from "./types.js";

/** How often, in milliseconds, the screen reads the clock again. */
const tick = 1_000;

/** The indent of what stands in for the list, in display cells. */
const indent = 2;

/** The entry after `item` in `list`, and the first after the last. */
function cycle<T>(list: readonly T[], item: T): T {
  const [next] = [...list.slice(list.indexOf(item) + 1), ...list];
  return next;
}

/** Reads a sentence as a line on screen, which ends without a full stop. */
const dropFullStop = (sentence: string) => sentence.replace(/\.$/, "");

/**
 * Why the first fetch cannot go on, and what to do about it, or nothing
 * while a refresh runs or none has stopped. The reasons come in the order
 * the status line names them: a rate limit, what stopped the last
 * refresh, then a pause to spare the request budget. A pause stops the
 * refresh without a failure, so without this the list would say
 * `refresh in progress…` until it resumes.
 */
function describeHold(
  status: CacheStatus,
  timezone: string,
): { readonly reason: string; readonly recovery: string } | undefined {
  const { refreshing, paused, failure } = status;
  if (refreshing) return undefined;
  const resume = (until: Date) =>
    `wait: docket resumes at ${describeClock(until, timezone)}`;
  if (paused?.reason === "rateLimit") {
    const reason = "GitHub refused requests for its rate limit";
    return { reason, recovery: resume(paused.until) };
  }
  if (failure) {
    return {
      reason: dropFullStop(failure.message),
      recovery: failure.recovery,
    };
  }
  if (paused) {
    const reason = "docket paused the refresh to spare the request budget";
    return { reason, recovery: resume(paused.until) };
  }
  return undefined;
}

/** Stand in for the cache's store when there is no cache: nothing changes. */
const ignoreChanges = () => () => {};
const readNothing = () => undefined;

/**
 * The terminal interface's one screen: owed or activity, with the header
 * naming the mode and its address, the list region, the counts, the
 * status and the keys, or the help over all but the header. The keys are
 * bound in one global layer, and the help and the key bar are drawn from
 * its command catalogue.
 */
export default function Screen({
  mode: openingMode,
  owedGrouping: openingGrouping,
  now,
  settings,
  watched: opening,
  source,
  onQuit,
}: TerminalView & { readonly onQuit: () => void }): ReactNode {
  const { width, height } = useTerminalDimensions();
  const cache = "cache" in source ? source.cache : undefined;
  const readWatched = "cache" in source ? source.readWatched : undefined;
  const readThreadDetail = "cache" in source ? source.readDetail : undefined;
  // Read after the first frame: the files replace the opening settings,
  // or GitHub's refusal of gh's token stands in for the list.
  const [files, setFiles] = useState<WatchedFiles>();
  useEffect(() => {
    void readWatched?.().then(setFiles);
  }, [readWatched]);
  const watched = files && "watched" in files ? files.watched : opening;
  const problem =
    "problem" in source
      ? source.problem
      : files && "problem" in files
        ? files.problem
        : undefined;
  const status = useSyncExternalStore(
    cache?.subscribe ?? ignoreChanges,
    cache?.status ?? readNothing,
  );
  const cached = useSyncExternalStore(
    cache?.subscribe ?? ignoreChanges,
    cache?.threads ?? readNothing,
  );
  const [at, setAt] = useState(now);
  useEffect(() => {
    const timer = setInterval(() => setAt(now()), tick);
    return () => clearInterval(timer);
  }, [now]);

  // Without the stack relation there is nothing to group by stack.
  const owedChoices = owedGroupings.filter(
    (grouping) =>
      grouping !== "stack" ||
      ("capabilities" in source && source.capabilities.has("stacks")),
  );
  const [firstOwed] = owedChoices;
  const [firstActivity] = activityGroupings;
  const [firstWindow] = settings.activity;
  const [mode, setMode] = useState<TerminalMode>(openingMode);
  // A call may name by stack when the provider has no stacks to group by.
  const [owedGrouping, setOwedGrouping] = useState(
    owedChoices.includes(openingGrouping) ? openingGrouping : firstOwed,
  );
  const [activityGrouping, setActivityGrouping] = useState(firstActivity);
  const [window, setWindow] = useState(firstWindow);
  const [help, setHelp] = useState(false);
  const [selection, setSelection] = useState<Selection>({ place: 0, wait: "" });
  // The keys read the rows drawn last, so a binding never holds a list
  // older than the one on screen.
  const drawnRows = useRef<readonly WaitRow[]>([]);
  const moveSelection = (step: number) =>
    setSelection((current) => {
      const rows = drawnRows.current;
      const place = placeSelection(rows, current) + step;
      const row = rows.at(place);
      return row && place >= 0 ? { place, wait: identifyRow(row) } : current;
    });

  useBindings(
    () => ({
      commands: [
        {
          name: "mode.previous",
          desc: "switch mode (owed ↔ activity)",
          group: "Mode",
          hint: "mode",
          run: () => setMode("owed"),
        },
        {
          name: "mode.next",
          desc: "switch mode (owed ↔ activity)",
          group: "Mode",
          hint: "mode",
          notes: ["docket opens owed"],
          run: () => setMode("activity"),
        },
        {
          name: "selection.previous",
          desc: "move the selection",
          group: "List",
          hint: "sel",
          enabled: mode === "owed",
          run: () => moveSelection(-1),
        },
        {
          name: "selection.next",
          desc: "move the selection",
          group: "List",
          hint: "sel",
          notes: ["(opens the accordion)"],
          enabled: mode === "owed",
          run: () => moveSelection(1),
        },
        {
          name: "grouping.next",
          desc: "next grouping",
          group: "Mode",
          hint: "grp",
          run: () =>
            mode === "owed"
              ? setOwedGrouping((current) => cycle(owedChoices, current))
              : setActivityGrouping((current) =>
                  cycle(activityGroupings, current),
                ),
        },
        {
          name: "window.next",
          desc: "next time window (activity)",
          group: "Mode",
          hint: "time",
          notes: ["owed: most overdue first", "activity: newest first"],
          enabled: mode === "activity",
          run: () => setWindow((current) => cycle(settings.activity, current)),
        },
        {
          name: "help.toggle",
          desc: "show or hide help",
          group: "App",
          hint: "",
          run: () => setHelp((open) => !open),
        },
        {
          name: "refresh.full",
          desc: "full refresh",
          group: "App",
          run: () => void cache?.fullRefresh(),
        },
        { name: "app.quit", desc: "quit", group: "App", run: onQuit },
      ],
      bindings: [
        { key: "left", cmd: "mode.previous" },
        { key: "h", cmd: "mode.previous" },
        { key: "right", cmd: "mode.next" },
        { key: "l", cmd: "mode.next" },
        { key: "up", cmd: "selection.previous" },
        { key: "k", cmd: "selection.previous" },
        { key: "down", cmd: "selection.next" },
        { key: "j", cmd: "selection.next" },
        { key: "g", cmd: "grouping.next" },
        { key: "t", cmd: "window.next" },
        { key: "?", cmd: "help.toggle" },
        { key: "shift+r", cmd: "refresh.full" },
        { key: "q", cmd: "app.quit" },
      ],
    }),
    [mode, cache, onQuit],
  );
  const active = useCommands({ visibility: "active" });
  const bound = useCommands({ visibility: "registered" });

  const header =
    mode === "owed"
      ? describeOwedAddress({ mode, grouping: owedGrouping })
      : describeActivityAddress({ mode, window, grouping: activityGrouping });
  // The threads once there is data to show, or nothing to watch.
  const threads =
    !problem && cached && (cached.syncedAt || watched.length === 0)
      ? cached.threads
      : undefined;
  const owed =
    threads && mode === "owed"
      ? buildOwed(threads, watched, owedGrouping, at)
      : undefined;
  const room = width - indent;
  const rows = owed ? owed.groups.flatMap((group) => group.rows) : [];
  useEffect(() => {
    drawnRows.current = rows;
  });
  // A thread's details are read once for each copy of the data: moving the
  // selection back to a thread shows what was read, and each refresh
  // brings a copy that reads its own.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  const details = useMemo(
    () => new Map<string, Promise<ThreadDetail>>(),
    [cached],
  );

  // The list region: rows once the data is in, or what stands in for them.
  let region: ReactNode = null;
  if (problem) {
    const { message, recovery } = problem;
    region = (
      <Notice
        reason={dropFullStop(message)}
        recovery={recovery}
        width={width}
      />
    );
  } else if (!threads) {
    const held = status && describeHold(status, settings.time.timezone);
    region = held ? (
      <Notice reason={held.reason} recovery={held.recovery} width={width} />
    ) : (
      <box flexDirection="column" paddingLeft={indent}>
        <text fg={tokens["color.text"]}>refresh in progress…</text>
        <ProgressLine
          fetched={status?.fullRefresh?.fetched ?? 0}
          total={status?.fullRefresh?.total ?? 0}
          width={room}
        />
      </box>
    );
  } else if (owed?.groups.length === 0) {
    region = <EmptyState message="nothing owed" width={width} />;
  } else if (owed && readThreadDetail) {
    const readDetail = (row: WaitRow) => {
      const key = row.reference.text;
      const reading = details.get(key) ?? readThreadDetail(row.wait.thread);
      details.set(key, reading);
      return reading;
    };
    region = (
      <OwedList
        list={owed}
        selected={placeSelection(rows, selection)}
        readDetail={readDetail}
        now={at}
        timezone={settings.time.timezone}
        width={width}
        height={height - 4}
      />
    );
  }

  return (
    <Pane
      width={width}
      header={
        help ? (
          <PaneHeader title="help" width={width} />
        ) : (
          <PaneHeader
            title={header.title.text}
            address={header.address?.text}
            width={width}
          />
        )
      }
      counts={owed && <CountsLine summary={owed.summary.text} width={width} />}
      status={
        <StatusLine
          status={problem ? undefined : status}
          now={at}
          timezone={settings.time.timezone}
          names={Object.fromEntries(
            watched.map(({ repo, name }) => [repo, name]),
          )}
          width={width}
        />
      }
      keys={<KeyBar commands={active} width={width} />}
      help={
        help ? (
          <HelpOverlay
            commands={bound}
            note="windows are counted in working time"
            width={width}
          />
        ) : undefined
      }
    >
      {owed && owed.groups.length > 0 ? (
        region
      ) : (
        <box paddingTop={1}>{region}</box>
      )}
    </Pane>
  );
}
