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
  type ThreadRow as ActivityThread,
  activityGroupings,
  describeAddress as describeActivityAddress,
} from "../lib/activity/index.js";
import {
  describeNoTeam,
  describeAddress as describeOwedAddress,
  owedGroupings,
  type WaitRow,
} from "../lib/owed/index.js";
import {
  type ActionResult,
  CountsLine,
  countPickerLines,
  HelpOverlay,
  KeyBar,
  minColumns,
  Notice,
  Pane,
  PaneHeader,
  PeoplePicker,
  wrapNotice,
} from "../lib/ui/index.js";
import type { Thread } from "../lib/waits/index.js";
import ActivityList from "./ActivityList.js";
import buildOwed from "./buildOwed.js";
import buildThreadWaits from "./buildThreadWaits.js";
import { standInIndent } from "./constants.js";
import describeCandidate from "./describeCandidate.js";
import drawStandIn from "./drawStandIn.js";
import drawStatusLine from "./drawStatusLine.js";
import findPeople from "./findPeople.js";
import gatherNamed from "./gatherNamed.js";
import identifyRow from "./identifyRow.js";
import listTeam from "./listTeam.js";
import OwedList from "./OwedList.js";
import placeSelection, { type Selection } from "./placeSelection.js";
import type {
  SelectedThread,
  TerminalMode,
  TerminalView,
  WatchedFiles,
} from "./types.js";
import useActivity from "./useActivity.js";
import useAttention, { type UseAttentionProps } from "./useAttention.js";
import useEditor from "./useEditor.js";
import useHeldDetails from "./useHeldDetails.js";
import useReadAhead from "./useReadAhead.js";
import useScreenKeys from "./useScreenKeys.js";
import useSelectedWatch from "./useSelectedWatch.js";
import useShownList from "./useShownList.js";
import useViewer from "./useViewer.js";

/** How often, in milliseconds, the screen reads the clock again. */
const tick = 1_000;

/** The entry after `item` in `list`, and the first after the last. */
function cycle<T>(list: readonly T[], item: T): T {
  const [next] = [...list.slice(list.indexOf(item) + 1), ...list];
  return next;
}

/** A thread's last change, as GitHub records it, and its checks. */
const describeVersion = ({ updatedAt, checks }: Thread) =>
  `${updatedAt.getTime()}|${checks ?? ""}`;

/** The thread a row names, in either mode. */
const summarize = (row: WaitRow | ActivityThread) =>
  "wait" in row ? row.wait.thread : row.thread;

/** Stand in for the cache's store when there is no cache: nothing changes. */
const ignoreChanges = () => () => {};
const readNothing = () => undefined;

/** Where a selection starts: on the first row. */
const unselected: Selection = { place: 0, row: "" };

/**
 * The terminal interface's one screen: owed or activity, with the header
 * naming the mode and its address, the list region, the counts, the
 * status and the keys, or the help over all but the header. The keys are
 * bound in one global layer, beside the layer of the editor that `a` and
 * `r` open, and the help and the key bar are drawn from the keymap's
 * command catalogue. Every key, whatever it does, counts as attention: it
 * keeps the pane active, or wakes an idle one, and still acts.
 */
export default function Screen({
  mode: openingMode,
  owedGrouping: openingGrouping,
  activity: openingActivity,
  now,
  openInBrowser,
  settings,
  watched: opening,
  source,
  attention,
  onQuit,
}: TerminalView &
  Partial<UseAttentionProps> & { readonly onQuit: () => void }): ReactNode {
  const { width, height } = useTerminalDimensions();
  // Below the narrowest pane the screen shows only that it needs more
  // columns, so no key but `q` acts on the list or the editor it hides.
  const narrow = width < minColumns;
  const attentionState = useAttention({ attention });
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
  const status = useSyncExternalStore(
    cache?.subscribe ?? ignoreChanges,
    cache?.status ?? readNothing,
  );
  const you = useViewer({
    readViewer: "cache" in source ? source.readViewer : undefined,
    syncedAt: status?.syncedAt,
  });
  const problem =
    "problem" in source
      ? source.problem
      : files && "problem" in files
        ? files.problem
        : you.problem;
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
  const [activityGrouping, setActivityGrouping] = useState(
    openingActivity?.grouping ?? firstActivity,
  );
  const [window, setWindow] = useState(openingActivity?.window ?? firstWindow);
  const [help, setHelp] = useState(false);
  // Each mode keeps its own selection, so switching back finds it where it
  // was left.
  const [selections, setSelections] = useState<
    Readonly<Record<TerminalMode, Selection>>
  >({ owed: unselected, activity: unselected });
  const [action, setAction] = useState<ActionResult>();
  // The keys read the rows drawn last, and the row selected among them,
  // so a binding never holds a list older than the one on screen.
  const drawnRows = useRef<readonly (WaitRow | ActivityThread)[]>([]);
  const drawnSelection = useRef<WaitRow | ActivityThread>(undefined);
  const heldThreads = cached?.threads;
  const named = useMemo(() => gatherNamed(heldThreads ?? []), [heldThreads]);
  const editor = useEditor({
    source: "cache" in source ? source : undefined,
    findTeam: (repo) => listTeam(watched, repo),
    describeCandidate: (name, thread) =>
      describeCandidate(name, thread, watched, you.viewer, named),
    now,
    onResult: setAction,
    covered: help || narrow,
  });
  const shownList = useShownList(mode);
  // Every move stops at the first or the last row, never past it.
  const moveTo = (choose: (place: number, last: number) => number) =>
    setSelections((current) => {
      const rows = drawnRows.current;
      const last = rows.length - 1;
      const chosen = choose(placeSelection(rows, current[mode]), last);
      const place = Math.max(0, Math.min(last, chosen));
      const row = rows.at(place);
      if (!row) return current;
      return { ...current, [mode]: { place, row: identifyRow(row) } };
    });

  // A row's thread as the data records it: an owed row carries its
  // thread, and an activity row names one the cache holds while it is
  // open.
  const findFacts = (row: WaitRow | ActivityThread): Thread | undefined => {
    if ("wait" in row) return row.wait.thread;
    const { repo, number } = row.thread;
    return cached?.threads.find(
      (each) => each.repo === repo && each.number === number,
    );
  };
  // The thread `a` and `r` act on, in either mode.
  const selectThread = (): SelectedThread | undefined => {
    const row = drawnSelection.current;
    if (!row) return undefined;
    const reference = row.reference.text;
    const thread = findFacts(row);
    return thread ? { reference, thread } : { reference };
  };
  const { active, bound } = useScreenKeys({
    mode,
    help,
    editorOpen: editor.open,
    narrow,
    actions: {
      switchMode: setMode,
      moveSelection: (step) => moveTo((place) => place + step),
      movePage: (direction) =>
        moveTo((place) => place + direction * shownList.pageRows.current),
      moveToEnd: (direction) =>
        moveTo((_place, last) => (direction < 0 ? 0 : last)),
      // Only a row is ever selected, in either mode, so a heading or a
      // stack never opens.
      openSelected: () => {
        const row = drawnSelection.current;
        if (!row) return;
        const { url } = "wait" in row ? row.wait.thread : row.thread;
        openInBrowser(url).catch(() =>
          setAction({
            failed: true,
            text: "could not open the browser",
            at: now(),
          }),
        );
      },
      nextGrouping: () =>
        mode === "owed"
          ? setOwedGrouping((current) => cycle(owedChoices, current))
          : setActivityGrouping((current) => cycle(activityGroupings, current)),
      nextWindow: () =>
        setWindow((current) => cycle(settings.activity, current)),
      edit: (action) => editor.start(action, selectThread()),
      toggleHelp: () => setHelp((open) => !open),
      closeHelp: () => setHelp(false),
      refresh: () => void cache?.fullRefresh(),
      quit: onQuit,
    },
  });

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
      ? buildOwed(threads, watched, owedGrouping, at, you.viewer)
      : undefined;
  const activity = useActivity({
    source,
    threads,
    syncedAt: status?.syncedAt,
    shown: mode === "activity",
    watched,
    window,
    grouping: activityGrouping,
    now,
    at,
    viewer: you.viewer,
  });
  const room = width - standInIndent;
  const listed = activity && "list" in activity ? activity.list : undefined;
  const rows: readonly (WaitRow | ActivityThread)[] =
    (owed ?? listed)?.groups.flatMap(
      (group): readonly (WaitRow | ActivityThread)[] => group.rows,
    ) ?? [];
  const selectedRow = rows.at(placeSelection(rows, selections[mode]));
  useEffect(() => {
    drawnRows.current = rows;
    drawnSelection.current = selectedRow;
    editor.follow(selectedRow?.reference.text);
  });
  useSelectedWatch({
    cache,
    selected: selectedRow && summarize(selectedRow),
    attention: attentionState,
  });
  // A row's version: its thread's last change, or, for a thread the data
  // does not hold, which only an activity row names, its newest event.
  const findVersion = (row: WaitRow | ActivityThread) => {
    const facts = findFacts(row);
    if (facts) return describeVersion(facts);
    return `${(row as ActivityThread).events.at(0)?.event.at.getTime()}`;
  };
  const ahead = useReadAhead({
    reader: "cache" in source ? source.details : undefined,
    rows: rows.map((row) => ({
      thread: summarize(row),
      version: findVersion(row),
    })),
    selected: placeSelection(rows, selections[mode]),
    attention: attentionState,
    paused: status?.paused !== undefined,
    now,
  });
  // A thread's details are read once for each change GitHub records on it,
  // and once for each change the list's roll-up of its checks shows, since
  // checks finish without GitHub recording a change to the thread. Any
  // other copy of the data a refresh brings reads nothing. A thread the
  // data does not hold, such as a closed one in activity, has no record of
  // its last change, and is read once for each newest event its row shows.
  // The details of a thread that left both the data and the list on screen
  // are let go.
  const readHeld = useHeldDetails({
    kept: [...(cached?.threads ?? []), ...rows.map(summarize)],
    selected: () => {
      const row = drawnSelection.current;
      return row && summarize(row);
    },
    resumes: status?.paused?.until,
  });
  /** The details the accordion under a row is given: read ahead, or alone. */
  const readRowDetail = (
    row: WaitRow | ActivityThread,
    readAlone: NonNullable<typeof readThreadDetail>,
  ) => {
    const version = findVersion(row);
    const thread = summarize(row);
    return readHeld(
      (each) => (ahead.read ?? readAlone)(each, version),
      thread,
      ahead.version(thread, version),
      findFacts(row),
    );
  };

  // What stands in the accordion's place: the open editor, or why a key
  // could not open one.
  const { picker, refusal } = editor;
  const refused = refusal && (
    <Notice reason={refusal.reason} recovery={refusal.recovery} width={width} />
  );
  const slot = picker
    ? {
        node: <PeoplePicker {...picker} width={width} />,
        lines: countPickerLines({ ...picker, width }),
      }
    : refusal && {
        node: refused,
        lines: Object.values(
          wrapNotice(refusal.reason, refusal.recovery, room),
        ).flat().length,
      };

  // The list region: rows once the data is in, or what stands in for them.
  // owed opens with a notice while a watched repository lists no team.
  const teamless = describeNoTeam(
    watched.map(({ resolved }) => resolved.settings.people),
  );
  let region = drawStandIn({
    mode,
    problem,
    refused: rows.length === 0 ? refused : undefined,
    held: threads !== undefined,
    status,
    timezone: settings.time.timezone,
    nothingOwed: owed?.groups.length === 0,
    teamless,
    owedListed: Boolean(owed && readThreadDetail),
    activity,
    watched,
    width,
  });
  if (region === undefined && owed && readThreadDetail) {
    region = (
      <OwedList
        list={owed}
        selected={placeSelection(rows, selections.owed)}
        readDetail={(row) => readRowDetail(row, readThreadDetail)}
        now={at}
        timezone={settings.time.timezone}
        width={width}
        height={height - 4}
        {...shownList.list}
        {...(teamless && { notice: teamless })}
        {...(slot && { editor: slot })}
      />
    );
  }
  if (listed && threads && readThreadDetail) {
    region = (
      <ActivityList
        list={listed}
        selected={placeSelection(rows, selections.activity)}
        readDetail={(row) => readRowDetail(row, readThreadDetail)}
        measureWaits={(row) =>
          buildThreadWaits(row.thread, threads, watched, at, you.viewer)
        }
        readPeople={(row) => findPeople(row.thread.repo, threads, watched)}
        viewer={you.viewer}
        now={at}
        timezone={settings.time.timezone}
        width={width}
        height={height - 4}
        {...shownList.list}
        {...(slot && { editor: slot })}
      />
    );
  }
  const summary = (owed ?? listed)?.summary;

  return (
    <Pane
      width={width}
      header={
        help ? (
          <PaneHeader title={{ text: "help", kind: "words" }} width={width} />
        ) : (
          <PaneHeader
            title={
              editor.title
                ? { text: editor.title, kind: "words" }
                : header.title
            }
            address={editor.title ? undefined : header.address}
            width={width}
          />
        )
      }
      counts={
        summary === undefined ? undefined : (
          <CountsLine summary={summary} width={width} />
        )
      }
      status={drawStatusLine({
        problem,
        status,
        // A failure reading activity's events, or whom gh is signed in
        // as, leaves the rows held.
        failure:
          (activity && "list" in activity ? activity.failure : undefined) ??
          you.failure,
        action,
        attention: attentionState,
        detailsPaused: "cache" in source && source.details?.isCapped(at),
        details: ahead.progress,
        now: at,
        timezone: settings.time.timezone,
        watched,
        width,
      })}
      keys={<KeyBar commands={active} width={width} />}
      help={
        help ? (
          <HelpOverlay
            commands={bound}
            note={{
              text: "windows are counted in working time",
              kind: "words",
            }}
            width={width}
          />
        ) : undefined
      }
    >
      {listed || (owed && owed.groups.length > 0) ? (
        region
      ) : (
        <box paddingTop={1}>{region}</box>
      )}
    </Pane>
  );
}
