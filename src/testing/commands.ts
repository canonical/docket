/**
 * The keys of the terminal interface as the help and the key bar receive
 * them, for their stories.
 */

import type { KeyCommand } from "../lib/ui/index.js";

const switchMode: KeyCommand = {
  keys: ["←", "→"],
  alternates: ["h", "l"],
  label: "switch mode (owed ↔ activity)",
  hint: "mode",
  group: "Mode",
  notes: ["docket opens owed"],
};

const moveSelection: KeyCommand = {
  keys: ["↑", "↓"],
  alternates: ["k", "j"],
  label: "move the selection",
  hint: "sel",
  group: "List",
  notes: ["(opens the accordion)"],
};

const nextGrouping: KeyCommand = {
  keys: ["g"],
  alternates: [],
  label: "next grouping",
  hint: "grp",
  group: "Mode",
  notes: [],
};

const nextWindow: KeyCommand = {
  keys: ["t"],
  alternates: [],
  label: "next time window (activity)",
  hint: "time",
  group: "Mode",
  notes: ["owed: most overdue first", "activity: newest first"],
};

const help: KeyCommand = {
  keys: ["?"],
  alternates: [],
  label: "show or hide help",
  hint: "",
  group: "App",
  notes: [],
};

const fullRefresh: KeyCommand = {
  keys: ["R"],
  alternates: [],
  label: "full refresh",
  group: "App",
  notes: [],
};

const quit: KeyCommand = {
  keys: ["q"],
  alternates: [],
  label: "quit",
  group: "App",
  notes: [],
};

const app: readonly KeyCommand[] = [help, fullRefresh, quit];

/** The keys that work in owed, where the time window does not apply. */
export const owedCommands: readonly KeyCommand[] = [
  switchMode,
  moveSelection,
  nextGrouping,
  ...app,
];

/** The keys that work in activity, where the selection does not move. */
export const activityCommands: readonly KeyCommand[] = [
  switchMode,
  nextGrouping,
  nextWindow,
  ...app,
];

/** Every key the help lists. */
export const everyCommand: readonly KeyCommand[] = [
  switchMode,
  moveSelection,
  nextGrouping,
  nextWindow,
  ...app,
];

const openThread: KeyCommand = {
  keys: ["⏎"],
  alternates: [],
  label: "open in the browser",
  hint: "open",
  group: "Thread",
  notes: [],
};

const threadKeys: readonly KeyCommand[] = [
  {
    keys: ["a"],
    alternates: [],
    label: "assign",
    hint: "",
    group: "Thread",
    notes: [],
  },
  {
    keys: ["r"],
    alternates: [],
    label: "request review",
    hint: "",
    group: "Thread",
    notes: [],
  },
];

/**
 * More keys with a hint than 40 columns hold: activity's, the thread's,
 * and the full refresh's, its key alone.
 */
export const longCommands: readonly KeyCommand[] = [
  switchMode,
  moveSelection,
  openThread,
  nextGrouping,
  nextWindow,
  ...threadKeys,
  { ...fullRefresh, hint: "" },
  help,
  quit,
];
