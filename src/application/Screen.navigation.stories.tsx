import type { Meta, StoryObj } from "@aztlan/lago-react";
import { ScreenFrame, viewRecording } from "../testing/screen.js";
import { atHeight, drawAtWidth } from "../testing/stories.js";

const meta = {
  title: "application/Screen/navigation",
  component: ScreenFrame,
  render: drawAtWidth(ScreenFrame),
} satisfies Meta<typeof ScreenFrame>;

export default meta;

const recording = viewRecording();

/**
 * A short pane scrolled inside ISSUES: the heading held at the top with
 * the place of the first row shown under it and the group's size, the
 * counts line giving the selection's own place, and the last line
 * counting every row under the pane, the pull requests after the issues.
 */
export const OwedPinnedHeading: StoryObj<typeof meta> = {
  args: {
    ...recording,
    owedGrouping: "kind",
    run: ["selection.next", "selection.next"],
  },
  parameters: { viewports: atHeight(14) },
};

/**
 * owed by owner after a page down: the selection on alice's last row,
 * her heading pinned with the place of the first row shown, and bob's
 * and the unassigned rows under the pane counted.
 */
export const OwedScrolled: StoryObj<typeof meta> = {
  args: {
    ...recording,
    owedGrouping: "owner",
    run: ["selection.next", "selection.pageDown"],
  },
  parameters: { viewports: atHeight(14) },
};

/**
 * The help at 24 lines, too short for it: it opens at its top, and its
 * last line counts the key lines under the pane, as a list counts its
 * rows.
 */
export const HelpShort: StoryObj<typeof meta> = {
  args: { ...recording, run: ["help.toggle"] },
  parameters: { viewports: atHeight(24) },
};
