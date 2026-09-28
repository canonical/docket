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
  /**
   * Moves the selection by as many rows as the list shows, up when
   * `direction` is negative.
   */
  readonly movePage: (direction: -1 | 1) => void;
  /**
   * Moves the selection to the first thread when `direction` is negative,
   * and to the last otherwise.
   */
  readonly moveToEnd: (direction: -1 | 1) => void;
  /** Opens the selected thread's page in the browser. */
  readonly openSelected: () => void;
  /** Shows the mode's next grouping. */
  readonly nextGrouping: () => void;
  /** Shows activity's next time window. */
  readonly nextWindow: () => void;
  /** Opens the editor for `action` on the selected thread, in either mode. */
  readonly edit: (action: WriteAction) => void;
  /** Shows the help, or hides it. */
  readonly toggleHelp: () => void;
  /** Hides the help. */
  readonly closeHelp: () => void;
  /** Discards the cached data and fetches everything again. */
  readonly refresh: () => void;
  /** Closes docket. */
  readonly quit: () => void;
}

/** Props for the useScreenKeys hook. */
export interface UseScreenKeysProps {
  /** The mode on screen: `t` acts in activity alone. */
  readonly mode: TerminalMode;
  /**
   * Whether the help is open, which `esc` then closes, and which turns
   * every key but the help's and `q` off.
   */
  readonly help: boolean;
  /** Whether an editor is open, which turns every key but the help's off. */
  readonly editorOpen: boolean;
  /** What each key does, as the frame on show gives it. */
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
  help,
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
          name: "selection.pageUp",
          desc: "a page up or down",
          group: "List",
          run: () => latest.current.movePage(-1),
        },
        {
          name: "selection.pageDown",
          desc: "a page up or down",
          group: "List",
          run: () => latest.current.movePage(1),
        },
        {
          name: "selection.first",
          desc: "the first or last thread",
          group: "List",
          run: () => latest.current.moveToEnd(-1),
        },
        {
          name: "selection.last",
          desc: "the first or last thread",
          group: "List",
          run: () => latest.current.moveToEnd(1),
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
          run: () => latest.current.edit("assign"),
        },
        {
          name: "thread.review",
          desc: "request review",
          group: "Thread",
          hint: "",
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
          name: "help.close",
          desc: "close help",
          group: "App",
          hint: "",
          // Off while the help is closed, so `esc` reaches an open
          // editor's cancel.
          enabled: help,
          run: () => latest.current.closeHelp(),
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
      ].map((command) => {
        // An open editor takes the typing, so no key but the help's runs;
        // and no key acts on what the help hides, so while it shows only
        // its own keys and quitting run.
        const runs = command.name.startsWith("help.")
          ? true
          : editorOpen
            ? false
            : !help || command.name === "app.quit";
        return runs ? command : { ...command, enabled: false };
      }),
      bindings: [
        { key: "left", cmd: "mode.previous" },
        { key: "h", cmd: "mode.previous" },
        { key: "right", cmd: "mode.next" },
        { key: "l", cmd: "mode.next" },
        { key: "up", cmd: "selection.previous" },
        { key: "k", cmd: "selection.previous" },
        { key: "down", cmd: "selection.next" },
        { key: "j", cmd: "selection.next" },
        { key: "pageup", cmd: "selection.pageUp" },
        { key: "pagedown", cmd: "selection.pageDown" },
        { key: "home", cmd: "selection.first" },
        { key: "end", cmd: "selection.last" },
        { key: "return", cmd: "thread.open" },
        { key: "a", cmd: "thread.assign" },
        { key: "r", cmd: "thread.review" },
        { key: "g", cmd: "grouping.next" },
        { key: "t", cmd: "window.next" },
        { key: "?", cmd: "help.toggle" },
        { key: "escape", cmd: "help.close" },
        { key: "shift+r", cmd: "refresh.full" },
        { key: "q", cmd: "app.quit" },
      ],
    }),
    [mode, help, editorOpen],
  );
  const active = useCommands({ visibility: "active" });
  const bound = useCommands({ visibility: "registered" }).toSorted(
    (a, b) => helpGroups.indexOf(a.group) - helpGroups.indexOf(b.group),
  );
  return { active, bound };
}
