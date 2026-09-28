import { useBindings } from "@opentui/keymap/react";
import { useTerminalDimensions } from "@opentui/react";
import {
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  activityGroupings,
  describeAddress as describeActivityAddress,
} from "../lib/activity/index.js";
import {
  describeAddress as describeOwedAddress,
  owedGroupings,
} from "../lib/owed/index.js";
import { tokens } from "../lib/tokens/index.js";
import {
  CountsLine,
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
import type { TerminalView } from "./types.js";

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
  now,
  settings,
  watched,
  source,
  onQuit,
}: TerminalView & { readonly onQuit: () => void }): ReactNode {
  const { width } = useTerminalDimensions();
  const cache = "cache" in source ? source.cache : undefined;
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
  const [mode, setMode] = useState<"owed" | "activity">("owed");
  const [owedGrouping, setOwedGrouping] = useState(firstOwed);
  const [activityGrouping, setActivityGrouping] = useState(firstActivity);
  const [window, setWindow] = useState(firstWindow);
  const [help, setHelp] = useState(false);

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
    cached && (cached.syncedAt || watched.length === 0)
      ? cached.threads
      : undefined;
  const owed =
    threads && mode === "owed"
      ? buildOwed(threads, watched, owedGrouping, at)
      : undefined;
  const room = width - indent;

  // The list region: rows once the data is in, or what stands in for them.
  let region: ReactNode = null;
  if ("problem" in source) {
    const { message, recovery } = source.problem;
    region = (
      <Notice
        reason={dropFullStop(message)}
        recovery={recovery}
        width={width}
      />
    );
  } else if (!threads) {
    region =
      status?.failure && !status.refreshing ? (
        <Notice
          reason={dropFullStop(status.failure.message)}
          recovery={status.failure.recovery}
          width={width}
        />
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
          status={status}
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
      <box paddingTop={1}>{region}</box>
    </Pane>
  );
}
