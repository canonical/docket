import { useBindings } from "@opentui/keymap/react";
import { useRef } from "react";
import { type UseCommandsResult, useCommands } from "../lib/ui/index.js";
import type { TerminalMode } from "./types.js";
import type { WriteAction } from "./writeSet.js";

/** What the screen's keys do. */
export interface ScreenActions {
  /** Shows `mode`. */
  readonly switchMode: (mode: TerminalMode) => void;
  /** Moves the selection by `step` rows, up when it is negative. */
  readonly moveSelection: (step: number) => void;
  /** Opens the selected thread's page in the browser. */
  readonly openSelected: () => void;
  /** Shows the mode's next grouping. */
  readonly nextGrouping: () => void;
  /** Shows activity's next time window. */
  readonly nextWindow: () => void;
  /** Opens the editor for `action` on the selected row. */
  readonly edit: (action: WriteAction) => void;
  /** Shows the help, or hides it. */
  readonly toggleHelp: () => void;
  /** Discards the cached data and fetches everything again. */
  readonly refresh: () => void;
  readonly quit: () => void;
}

/** Props for the useScreenKeys hook. */
export interface UseScreenKeysProps {
  /** The mode on screen: `t` acts in activity, and `a` and `r` in owed. */
  readonly mode: TerminalMode;
  /** Whether an editor is open, which turns every key but the help's off. */
  readonly editorOpen: boolean;
  readonly actions: ScreenActions;
}

/** Result of the useScreenKeys hook. */
export interface UseScreenKeysResult {
  /** The commands a key runs now, which the key bar names. */
  readonly active: UseCommandsResult;
  /** Every command bound, in the help's order of groups. */
  readonly bound: UseCommandsResult;
}

/** The help's groups, in the order keys act: from the mode down to the app. */
const helpGroups = ["Mode", "List", "Thread", "Editor", "App"];

/**
 * The screen's global layer of keys, and the commands the key bar and the
 * help draw from the keymap's catalogue. Each command carries its help
 * label, its group and its key-bar hint, so a key changes only here.
 */
export default function useScreenKeys({
  mode,
  editorOpen,
  actions,
}: UseScreenKeysProps): UseScreenKeysResult {
  // The keys run closures made when their layer was bound, so they read
  // the actions of the latest frame, never those of the frame that bound
  // them.
  const latest = useRef(actions);
  latest.current = actions;
  useBindings(
    () => ({
      commands: [
        {
          name: "mode.previous",
          desc: "switch mode (owed ↔ activity)",
          group: "Mode",
          hint: "mode",
          run: () => latest.current.switchMode("owed"),
        },
        {
          name: "mode.next",
          desc: "switch mode (owed ↔ activity)",
          group: "Mode",
          hint: "mode",
          notes: ["docket opens owed"],
          run: () => latest.current.switchMode("activity"),
        },
        {
          name: "selection.previous",
          desc: "move the selection",
          group: "List",
          hint: "sel",
          run: () => latest.current.moveSelection(-1),
        },
        {
          name: "selection.next",
          desc: "move the selection",
          group: "List",
          hint: "sel",
          notes: ["(opens the accordion)"],
          run: () => latest.current.moveSelection(1),
        },
        {
          name: "thread.open",
          desc: "open in the browser",
          group: "Thread",
          hint: "open",
          run: () => latest.current.openSelected(),
        },
        {
          name: "grouping.next",
          desc: "next grouping",
          group: "Mode",
          hint: "grp",
          run: () => latest.current.nextGrouping(),
        },
        {
          name: "window.next",
          desc: "next time window (activity)",
          group: "Mode",
          hint: "time",
          notes: ["owed: most overdue first", "activity: newest first"],
          enabled: mode === "activity",
          run: () => latest.current.nextWindow(),
        },
        {
          name: "thread.assign",
          desc: "assign",
          group: "Thread",
          hint: "",
          enabled: mode === "owed",
          run: () => latest.current.edit("assign"),
        },
        {
          name: "thread.review",
          desc: "request review",
          group: "Thread",
          hint: "",
          enabled: mode === "owed",
          run: () => latest.current.edit("review"),
        },
        {
          name: "help.toggle",
          desc: "show or hide help",
          group: "App",
          hint: "",
          run: () => latest.current.toggleHelp(),
        },
        {
          name: "refresh.full",
          desc: "full refresh",
          group: "App",
          run: () => latest.current.refresh(),
        },
        {
          name: "app.quit",
          desc: "quit",
          group: "App",
          run: () => latest.current.quit(),
        },
        // An open editor takes the typing, so no other key but help runs.
      ].map((command) =>
        editorOpen && command.name !== "help.toggle"
          ? { ...command, enabled: false }
          : command,
      ),
      bindings: [
        { key: "left", cmd: "mode.previous" },
        { key: "h", cmd: "mode.previous" },
        { key: "right", cmd: "mode.next" },
        { key: "l", cmd: "mode.next" },
        { key: "up", cmd: "selection.previous" },
        { key: "k", cmd: "selection.previous" },
        { key: "down", cmd: "selection.next" },
        { key: "j", cmd: "selection.next" },
        { key: "return", cmd: "thread.open" },
        { key: "a", cmd: "thread.assign" },
        { key: "r", cmd: "thread.review" },
        { key: "g", cmd: "grouping.next" },
        { key: "t", cmd: "window.next" },
        { key: "?", cmd: "help.toggle" },
        { key: "shift+r", cmd: "refresh.full" },
        { key: "q", cmd: "app.quit" },
      ],
    }),
    [mode, editorOpen],
  );
  const active = useCommands({ visibility: "active" });
  const bound = useCommands({ visibility: "registered" }).toSorted(
    (a, b) => helpGroups.indexOf(a.group) - helpGroups.indexOf(b.group),
  );
  return { active, bound };
}
