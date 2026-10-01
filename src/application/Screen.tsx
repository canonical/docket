import { useTerminalDimensions } from "@opentui/react";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { describeNoTeam } from "../lib/owed/index.js";
import {
  type ActionResult,
  CountsLine,
  HelpOverlay,
  KeyBar,
  minColumns,
  minLines,
  Pane,
  PaneHeader,
} from "../lib/ui/index.js";
import type { Thread } from "../lib/waits/index.js";
import ActivityList from "./ActivityList.js";
import buildOwed from "./buildOwed.js";
import buildThreadWaits from "./buildThreadWaits.js";
import describeCandidate from "./describeCandidate.js";
import describePosition from "./describePosition.js";
import describeRowVersion from "./describeRowVersion.js";
import drawEditorSlot from "./drawEditorSlot.js";
import drawStandIn from "./drawStandIn.js";
import drawStatusLine from "./drawStatusLine.js";
import FinishedList from "./FinishedList.js";
import findPeople from "./findPeople.js";
import gatherNamed from "./gatherNamed.js";
import identifyRow from "./identifyRow.js";
import listTeam from "./listTeam.js";
import OwedList from "./OwedList.js";
import placeSelection, { type Selection } from "./placeSelection.js";
import type {
  ListRow,
  SelectedThread,
  TerminalMode,
  TerminalView,
  WatchedFiles,
} from "./types.js";
import useActivity from "./useActivity.js";
import useAddress from "./useAddress.js";
import useAttention, { type UseAttentionProps } from "./useAttention.js";
import useEditor from "./useEditor.js";
import useFinished from "./useFinished.js";
import useHeldDetails from "./useHeldDetails.js";
import useHelp from "./useHelp.js";
import useReadAhead from "./useReadAhead.js";
import useScreenKeys from "./useScreenKeys.js";
import useSelectedWatch from "./useSelectedWatch.js";
import useShownList from "./useShownList.js";
import useViewer from "./useViewer.js";

/** How often, in milliseconds, the screen reads the clock again. */
const tick = 1_000;

/** The thread a row names, in any mode. */
const summarize = (row: ListRow) =>
  "wait" in row ? row.wait.thread : row.thread;

/** Stand in for the cache's store when there is no cache: nothing changes. */
const ignoreChanges = () => () => {};
const readNothing = () => undefined;

/** Where a selection starts: on the first row. */
const unselected: Selection = { place: 0, row: "" };

/**
 * The terminal interface's one screen: owed, activity or finished, or setup
 * while a prerequisite is missing, with the header naming the mode and its
 * address, the list region, the counts, the status and the keys, or the help
 * over all but the header. The keys are bound in one global layer, beside the
 * layer of the editor that `a` and `r` open, and the help and the key bar are
 * drawn from the keymap's command catalogue. Every key, whatever it does,
 * counts as attention: it keeps the pane active, or wakes an idle one, and
 * still acts.
 */
export default function Screen({
  mode: openingMode,
  owedGrouping: openingGrouping,
  activity: openingActivity,
  finished: openingFinished,
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
  // Below the narrowest or the shortest pane the screen shows only what
  // it needs, so no key but `q` acts on the list or the editor it hides.
  const tooSmall = width < minColumns || height < minLines;
  const attentionState = useAttention({ attention });
  // Without gh, or signed out of it, the screen is setup, which stands in
  // for any mode until the prerequisite is met: it names none, and
  // lists nothing.
  const setup = "problem" in source;
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

  const address = useAddress({
    mode: openingMode,
    owedGrouping: openingGrouping,
    activity: openingActivity,
    finished: openingFinished,
    windows: settings.activity,
    stacks: "capabilities" in source && source.capabilities.has("stacks"),
  });
  const { mode, owedGrouping, activityGrouping, window, header } = address;
  const { finishedGrouping, finishedWindow } = address;
  const helpState = useHelp();
  const help = helpState.open;
  // Each mode keeps its own selection, so switching back finds it where it
  // was left.
  const [selections, setSelections] = useState<
    Readonly<Record<TerminalMode, Selection>>
  >({ owed: unselected, activity: unselected, finished: unselected });
  const [action, setAction] = useState<ActionResult>();
  // The keys read the rows drawn last, and the row selected among them,
  // so a binding never holds a list older than the one on screen.
  const drawnRows = useRef<readonly ListRow[]>([]);
  const drawnSelection = useRef<ListRow>(undefined);
  const heldThreads = cached?.threads;
  const named = useMemo(() => gatherNamed(heldThreads ?? []), [heldThreads]);
  const editor = useEditor({
    source: "cache" in source ? source : undefined,
    findTeam: (repo) => listTeam(watched, repo),
    describeCandidate: (name, thread) =>
      describeCandidate(name, thread, watched, you.viewer, named),
    now,
    onResult: setAction,
    covered: help || tooSmall,
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
  // thread, and another row names one the cache holds while it is open.
  const findFacts = (row: ListRow): Thread | undefined => {
    if ("wait" in row) return row.wait.thread;
    const { repo, number } = row.thread;
    return cached?.threads.find(
      (each) => each.repo === repo && each.number === number,
    );
  };
  // The thread `a` and `r` act on, in owed or activity.
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
    tooSmall,
    setup,
    actions: {
      stepMode: address.stepMode,
      // While the help shows, the movement keys scroll it instead.
      moveSelection: (step) =>
        help ? helpState.scroll(step) : moveTo((place) => place + step),
      movePage: (direction) =>
        help
          ? helpState.page(direction)
          : moveTo((place) => place + direction * shownList.pageRows.current),
      moveToEnd: (direction) =>
        help
          ? helpState.end(direction)
          : moveTo((_place, last) => (direction < 0 ? 0 : last)),
      // Only a row is ever selected, in any mode, so a heading or a
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
      nextGrouping: address.nextGrouping,
      nextWindow: address.nextWindow,
      edit: (action) => editor.start(action, selectThread()),
      toggleHelp: helpState.toggle,
      closeHelp: helpState.close,
      refresh: () => void cache?.fullRefresh(),
      quit: onQuit,
    },
  });

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
  const finished = useFinished({
    source,
    threads,
    syncedAt: status?.syncedAt,
    shown: mode === "finished",
    watched,
    window: finishedWindow,
    grouping: finishedGrouping,
    now,
    at,
    viewer: you.viewer,
  });
  // Only the mode on screen reads its window, so at most one is held.
  const windowed = activity ?? finished;
  // The header, the counts, the status and the keys take a line each, and
  // a pane shorter than they are leaves the list no line, never fewer.
  const listHeight = Math.max(0, height - 4);
  const listed = activity && "list" in activity ? activity.list : undefined;
  const ended = finished && "list" in finished ? finished.list : undefined;
  const shown = owed ?? listed ?? ended;
  const rows: readonly ListRow[] =
    shown?.groups.flatMap((group): readonly ListRow[] => group.rows) ?? [];
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
  const findVersion = (row: ListRow) => describeRowVersion(row, findFacts(row));
  // A finished thread's accordion comes whole from the list, but for a
  // stacked pull request's neighbours, so only those are read ahead, and
  // only while one is selected.
  const detailed = rows.filter((row) => !("ending" in row) || row.stacked);
  const chosen = selectedRow ? detailed.indexOf(selectedRow) : -1;
  const ahead = useReadAhead({
    reader: "cache" in source ? source.details : undefined,
    rows: detailed.map((row) => ({
      thread: summarize(row),
      version: findVersion(row),
    })),
    selected: chosen < 0 ? detailed.length : chosen,
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
    row: ListRow,
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

  const { refused, slot } = drawEditorSlot(editor, width);

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
    windowed,
    ...(ended?.empty && { emptyWindow: ended.empty.text }),
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
        height={listHeight}
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
        height={listHeight}
        {...shownList.list}
        {...(slot && { editor: slot })}
      />
    );
  }
  if (region === undefined && ended && threads && readThreadDetail) {
    region = (
      <FinishedList
        list={ended}
        selected={placeSelection(rows, selections.finished)}
        readDetail={(row) => readRowDetail(row, readThreadDetail)}
        now={at}
        timezone={settings.time.timezone}
        width={width}
        height={listHeight}
        {...shownList.list}
      />
    );
  }
  const summary = shown?.summary.text;
  const position = describePosition(
    shown?.groups ?? [],
    placeSelection(rows, selections[mode]),
  );

  return (
    <Pane
      width={width}
      height={height}
      header={
        help || setup ? (
          <PaneHeader title={help ? "help" : "setup"} width={width} />
        ) : (
          <PaneHeader
            title={editor.title ?? header.title}
            {...(!editor.title && {
              address: header.address,
              sort: header.sort,
            })}
            width={width}
          />
        )
      }
      counts={
        summary === undefined ? undefined : (
          <CountsLine
            summary={summary}
            {...(position && { position })}
            width={width}
          />
        )
      }
      status={drawStatusLine({
        problem,
        status,
        // A failure reading the window on screen, or whom gh is signed
        // in as, leaves the rows held.
        failure:
          (windowed && "list" in windowed ? windowed.failure : undefined) ??
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
            {...(!setup && { note: "windows are counted in working time" })}
            width={width}
            height={Math.max(0, height - 1)}
            first={helpState.first}
            onShown={helpState.onShown}
          />
        ) : undefined
      }
    >
      {listed || (shown && shown.groups.length > 0) ? (
        region
      ) : (
        <box paddingTop={1}>{region}</box>
      )}
    </Pane>
  );
}
