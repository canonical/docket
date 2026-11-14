import type { Meta, StoryObj } from "@aztlan/lago-react";
import { readWeekDetail, weekEndings } from "../testing/endings.js";
import {
  ScreenFrame,
  type ScreenFrameProps,
  viewRecording,
} from "../testing/screen.js";
import { atHeight, drawAtWidth } from "../testing/stories.js";

const meta = {
  title: "application/Screen/finished",
  component: ScreenFrame,
  render: drawAtWidth(ScreenFrame),
} satisfies Meta<typeof ScreenFrame>;

export default meta;

const week = { amount: 1, unit: "w" } as const;

/** finished over a week of the recording, its threads' stacks read as their details give them. */
const recording = {
  ...viewRecording({ finished: weekEndings, read: readWeekDetail }),
  mode: "finished",
} as const;

/** The frames of finished are drawn on a pane of 24 lines. */
const parameters = { viewports: atHeight(24) };

/**
 * finished by kind, as it opens: the newest issue selected, within its
 * target, with what its time to close leaves unsaid and its labels, and
 * the counts with the position.
 */
export const FinishedByKind: StoryObj<typeof meta> = {
  args: { ...recording, finished: { window: week, grouping: "kind" } },
  parameters,
};

/** finished by author, each login that opened a thread with their group, alphabetically. */
export const FinishedByAuthor: StoryObj<typeof meta> = {
  args: { ...recording, finished: { window: week, grouping: "author" } },
  parameters,
};

/** finished by ending, the endings in GitHub's words as sections, by kind then GitHub's order. */
export const FinishedByEnding: StoryObj<typeof meta> = {
  args: { ...recording, finished: { window: week, grouping: "ending" } },
  parameters,
};

/**
 * finished as one list, a stacked pull request merged past its target
 * selected: the open time and the target, its labels and its stack's
 * lines, the heavy red bar running down to its ending. The selection
 * goes to the first thread once the window is read, then two down.
 */
export const FinishedOneList: StoryObj<typeof meta> = {
  args: {
    ...recording,
    finished: { window: week, grouping: "none" },
    run: ["selection.first", "selection.next", "selection.next"],
  },
  parameters,
};

/** A window in which nothing finished. */
export const FinishedEmpty: StoryObj<typeof meta> = {
  args: {
    ...viewRecording(),
    mode: "finished",
    finished: { window: week, grouping: "kind" },
  },
  parameters,
};
