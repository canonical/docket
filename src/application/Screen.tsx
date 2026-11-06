// Longer than 500 lines because the screen composes navigation, lists, and status in one place.
import { useTerminalDimensions } from "@opentui/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ThreadRow as ActivityThread } from "../lib/activity/index.js";
import type { FinishedThread } from "../lib/endings/index.js";
import { describeEmptyInbox } from "../lib/inbox/index.js";
import { describeNoTeam, groupWaits, listWaits } from "../lib/owed/index.js";
import {
  type ActionResult,
  CountsLine,
  EmptyState,
  HelpOverlay,
  KeyBar,
  Loading,
  minColumns,
  minLines,
  Notice,
  Pane,
  PaneHeader,
} from "../lib/ui/index.js";
import type { Thread, ThreadSummary } from "../lib/waits/index.js";
import ActivityList from "./ActivityList.js";
import buildThreadWaits from "./buildThreadWaits.js";
import { standInIndent } from "./constants.js";
import describeCandidate from "./describeCandidate.js";
import describeFailure from "./describeFailure.js";
import describePosition from "./describePosition.js";
import drawEditorSlot from "./drawEditorSlot.js";
import drawStandIn from "./drawStandIn.js";
import drawStatusLine from "./drawStatusLine.js";
import FinishedList from "./FinishedList.js";
import findPeople from "./findPeople.js";
import gatherNamed from "./gatherNamed.js";
import InboxList from "./InboxList.js";
import identifyRow from "./identifyRow.js";
import listTeam from "./listTeam.js";
import OwedList from "./OwedList.js";
import placeSelection, { type Selection } from "./placeSelection.js";
import prepareOwed from "./prepareOwed.js";
import type {
  ListRow,
  SelectedThread,
  TerminalMode,
  TerminalView,
  ThreadListRow,
  WatchedFiles,
} from "./types.js";
import useActivity from "./useActivity.js";
import useAddress from "./useAddress.js";
import useAttention, { type UseAttentionProps } from "./useAttention.js";
import useEditor from "./useEditor.js";
import useFinished from "./useFinished.js";
import useHelp from "./useHelp.js";
import useInbox from "./useInbox.js";
import useRowDetails from "./useRowDetails.js";
import useScreenKeys from "./useScreenKeys.js";
import useSelectedWatch from "./useSelectedWatch.js";
import useShownList from "./useShownList.js";
import useViewer from "./useViewer.js";

/** How often, in milliseconds, the screen reads the clock again. */
const tick = 1_000;

/** The thread a row names, in any mode but the inbox, which names none. */
const summarize = (row: ThreadListRow): ThreadSummary | FinishedThread =>
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
  const {
    mode,
    owedGrouping,
    activityGrouping,
    window,
    inboxGrouping,
    inboxFilter,
    header,
  } = address;
  const { finishedGrouping, finishedWindow } = address;
  const inbox = useInbox({
    source,
    shown: mode === "inbox",
    attention: attentionState,
    syncedAt: status?.syncedAt,
    watched,
    grouping: inboxGrouping,
    filter: inboxFilter,
    now,
    at,
  });
  const helpState = useHelp();
  const help = helpState.open;
  // Each mode keeps its own selection, so switching back finds it where it
  // was left.
  const [selections, setSelections] = useState<
    Readonly<Record<TerminalMode, Selection>>
  >({
    owed: unselected,
    activity: unselected,
    finished: unselected,
    inbox: unselected,
  });
  const [action, setAction] = useState<ActionResult>();
  // The keys read the rows drawn last, and the row selected among them,
  // so a binding never holds a list older than the one on screen.
  const drawnRows = useRef<readonly ListRow[]>([]);
  const drawnSelection = useRef<ListRow>(undefined);
  const heldThreads = cached?.threads;
  const named = useMemo(() => gatherNamed(heldThreads ?? []), [heldThreads]);
  const factsByThread = useMemo(
    () =>
      new Map(
        heldThreads?.map((thread) => [
          `${thread.repo}#${thread.number}`,
          thread,
        ]),
      ),
    [heldThreads],
  );
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
  const findFacts = useCallback(
    (row: ThreadListRow): Thread | undefined => {
      if ("wait" in row) return row.wait.thread;
      const { repo, number } = row.thread;
      return factsByThread.get(`${repo}#${number}`);
    },
    [factsByThread],
  );
  // The thread `a` and `r` act on, in owed or activity.
  const selectThread = (): SelectedThread | undefined => {
    const row = drawnSelection.current;
    if (!row || "notification" in row) return undefined;
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
      // Only a row is ever selected, in any mode, so a heading or a stack
      // never opens.
      openSelected: () => {
        const row = drawnSelection.current;
        if (!row) return;
        const url =
          "notification" in row
            ? row.url
            : "wait" in row
              ? row.wait.thread.url
              : row.thread.url;
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
      toggleInbox: address.toggleInbox,
      toggleInboxFilter: address.toggleInboxFilter,
      markRead: () => {
        const row = drawnSelection.current;
        if (!row || !("notification" in row) || !("cache" in source)) return;
        void source.markNotificationRead(row.notification.id).catch((error) => {
          setAction({
            failed: true,
            text: describeFailure(error).message,
            at: now(),
          });
        });
      },
      edit: (action) => editor.start(action, selectThread()),
      toggleHelp: helpState.toggle,
      closeHelp: helpState.close,
      // A full refresh that threw the data away reads the details again;
      // in the inbox it reads the notifications again instead.
      refresh: () => {
        if (mode === "inbox" && "cache" in source) {
          void source.refreshInbox().catch((error) => {
            setAction({
              failed: true,
              text: describeFailure(error).message,
              at: now(),
            });
          });
          return;
        }
        void cache
          ?.fullRefresh()
          .then((discarded) => discarded && ahead.drop());
      },
      quit: onQuit,
    },
  });

  // The threads once there is data to show, or nothing to watch.
  const threads =
    !problem && cached && (cached.syncedAt || watched.length === 0)
      ? cached.threads
      : undefined;
  const preparedOwed = useMemo(
    () =>
      threads && mode === "owed" ? prepareOwed(threads, watched) : undefined,
    [threads, mode, watched],
  );
  const measuredOwed = useMemo(
    () => (preparedOwed ? listWaits(preparedOwed, at, you.viewer) : undefined),
    [preparedOwed, at, you.viewer],
  );
  const owed = useMemo(
    () =>
      measuredOwed &&
      groupWaits(
        measuredOwed,
        { mode: "owed", grouping: owedGrouping },
        watched,
      ),
    [measuredOwed, owedGrouping, watched],
  );
  const measureActivityWaits = useMemo(() => {
    const byThread = new Map<string, ReturnType<typeof buildThreadWaits>>();
    return (row: ActivityThread) => {
      const { repo, number } = summarize(row);
      const key = `${repo}#${number}`;
      let waits = byThread.get(key);
      if (!waits && threads) {
        waits = buildThreadWaits(
          summarize(row),
          threads,
          watched,
          at,
          you.viewer,
        );
        byThread.set(key, waits);
      }
      return waits ?? [];
    };
  }, [threads, watched, at, you.viewer]);
  const readActivityPeople = useMemo(() => {
    const byRepo = new Map<string, ReturnType<typeof findPeople>>();
    return (repo: string) => {
      let people = byRepo.get(repo);
      if (!people && threads) {
        people = findPeople(repo, threads, watched);
        byRepo.set(repo, people);
      }
      return people ?? new Map();
    };
  }, [threads, watched]);
  const activity = useActivity({
    source,
    threads,
    syncedAt: status?.syncedAt,
    shown: mode === "activity",
    attention: attentionState,
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
    attention: attentionState,
    watched,
    window: finishedWindow,
    grouping: finishedGrouping,
    now,
    at,
    viewer: you.viewer,
  });
  // Both windowed modes read their windows, on screen or not, so a
  // switch of mode finds its list already read; the status line names a
  // failure reading the window on screen alone.
  const windowed =
    mode === "activity" ? activity : mode === "finished" ? finished : undefined;
  // The header, the counts, the status and the keys take a line each, and
  // a pane shorter than they are leaves the list no line, never fewer.
  const listHeight = Math.max(0, height - 4);
  const listed = activity && "list" in activity ? activity.list : undefined;
  const ended = finished && "list" in finished ? finished.list : undefined;
  // The mode on screen's list alone drives the keys and the counts, so a
  // list read off screen is never what a key acts on.
  const inboxListed = inbox && "list" in inbox ? inbox.list : undefined;
  const shown =
    mode === "owed"
      ? owed
      : mode === "activity"
        ? listed
        : mode === "finished"
          ? ended
          : inboxListed;
  const rows: readonly ListRow[] = useMemo(
    () =>
      shown?.groups.flatMap((group): readonly ListRow[] => group.rows) ?? [],
    [shown],
  );
  const selectedRow = rows.at(placeSelection(rows, selections[mode]));
  const selectedThread =
    selectedRow && !("notification" in selectedRow)
      ? summarize(selectedRow)
      : undefined;
  const threadRows = useMemo(
    () => rows.filter((row): row is ThreadListRow => !("notification" in row)),
    [rows],
  );
  const selectedThreadRow =
    selectedRow && !("notification" in selectedRow) ? selectedRow : undefined;
  useEffect(() => {
    drawnRows.current = rows;
    drawnSelection.current = selectedRow;
    editor.follow(selectedRow?.reference.text);
  });
  useSelectedWatch({
    cache,
    selected: selectedThread,
    attention: attentionState,
  });
  const ahead = useRowDetails({
    reader: "cache" in source ? source.details : undefined,
    rows: threadRows,
    selected: selectedThreadRow,
    drawnSelected: () => {
      const row = drawnSelection.current;
      return row && !("notification" in row) ? row : undefined;
    },
    held: cached?.threads ?? [],
    findFacts,
    attention: attentionState,
    status,
  });

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
    ...(mode === "finished" &&
      ended?.empty &&
      !(windowed && "list" in windowed && windowed.partial) && {
        emptyWindow: ended.empty,
      }),
    watched,
    width,
  });
  if (mode === "inbox" && !problem) {
    if (inbox && "problem" in inbox) {
      region = (
        <Notice
          reason={inbox.problem.message.replace(/\.$/, "")}
          recovery={inbox.problem.recovery}
          width={width}
        />
      );
    } else if (inboxListed) {
      region =
        inboxListed.groups.length === 0 ? (
          <EmptyState
            message={describeEmptyInbox(inboxListed.address)}
            width={width}
          />
        ) : (
          <InboxList
            list={inboxListed}
            selected={placeSelection(rows, selections.inbox)}
            width={width}
            height={listHeight}
            {...shownList.list}
          />
        );
    } else {
      region = (
        <box paddingLeft={standInIndent}>
          <Loading
            label={{ text: "refresh in progress…", kind: "words" }}
            width={width - standInIndent}
          />
        </box>
      );
    }
  }
  if (region === undefined && owed && readThreadDetail) {
    region = (
      <OwedList
        list={owed}
        selected={placeSelection(rows, selections.owed)}
        readDetail={(row) => ahead.readRowDetail(row, readThreadDetail)}
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
  if (mode === "activity" && listed && threads && readThreadDetail) {
    region = (
      <ActivityList
        list={listed}
        selected={placeSelection(rows, selections.activity)}
        readDetail={(row) => ahead.readRowDetail(row, readThreadDetail)}
        measureWaits={measureActivityWaits}
        readPeople={(row) => readActivityPeople(row.thread.repo)}
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
  if (
    region === undefined &&
    mode === "finished" &&
    ended &&
    threads &&
    readThreadDetail
  ) {
    region = (
      <FinishedList
        list={ended}
        selected={placeSelection(rows, selections.finished)}
        readDetail={(row) => ahead.readRowDetail(row, readThreadDetail)}
        now={at}
        timezone={settings.time.timezone}
        width={width}
        height={listHeight}
        {...shownList.list}
      />
    );
  }
  const summary =
    shown?.summary && windowed && "list" in windowed && windowed.partial
      ? {
          fields: [
            { text: "partial", kind: "words" as const },
            ...shown.summary.fields,
          ],
        }
      : shown?.summary;
  const position = describePosition(
    shown?.groups ?? [],
    placeSelection(rows, selections[mode]),
  );
  // A list with its rows needs no room above it; what stands in for one
  // takes a blank line, whichever mode is on screen.
  const drawsRows =
    mode === "activity"
      ? listed !== undefined
      : (shown?.groups.length ?? 0) > 0;

  return (
    <Pane
      width={width}
      height={height}
      header={
        help || setup ? (
          <PaneHeader
            title={{ text: help ? "help" : "setup", kind: "words" }}
            width={width}
          />
        ) : (
          <PaneHeader
            title={
              editor.title
                ? { text: editor.title, kind: "identifier" }
                : { text: header.title, kind: "words" }
            }
            {...(!editor.title && {
              address: { text: header.address, kind: "words" },
              sort: { text: header.sort, kind: "words" },
            })}
            width={width}
          />
        )
      }
      counts={
        summary === undefined ? undefined : (
          <CountsLine
            summary={summary}
            {...(position && { position: { text: position, kind: "figure" } })}
            width={width}
          />
        )
      }
      // Setup has no state of its own, so its notice takes the lines.
      status={
        setup
          ? undefined
          : drawStatusLine({
              problem,
              status,
              // A failure reading the window on screen, or whom gh is
              // signed in as, leaves the rows held.
              failure:
                (mode === "inbox" && inbox && "failure" in inbox
                  ? inbox.failure
                  : windowed && "list" in windowed
                    ? windowed.failure
                    : undefined) ?? you.failure,
              // The window or inbox on screen's own data, whose age the
              // line names beside the threads'.
              readAt:
                mode === "inbox" && inbox && "readAt" in inbox
                  ? inbox.readAt
                  : windowed && "list" in windowed
                    ? windowed.readAt
                    : undefined,
              action,
              attention: attentionState,
              details: ahead.progress,
              budget: cache?.readBudgets().graphql,
              now: at,
              timezone: settings.time.timezone,
              watched,
              width,
            })
      }
      keys={<KeyBar commands={active} width={width} />}
      help={
        help ? (
          <HelpOverlay
            commands={bound}
            {...(!setup && {
              note: {
                text: "windows are counted in working time",
                kind: "words",
              },
            })}
            width={width}
            height={Math.max(0, height - 1)}
            first={helpState.first}
            onShown={helpState.onShown}
          />
        ) : undefined
      }
    >
      {drawsRows ? region : <box paddingTop={1}>{region}</box>}
    </Pane>
  );
}
