import {
  ScreenFrame,
  type ScreenFrameProps,
  viewRecording,
} from "../testing/screen.js";
import type { Meta, Story } from "../testing/stories.js";

const meta: Meta<ScreenFrameProps> = {
  title: "application/Screen/navigation",
  component: ScreenFrame,
};

export default meta;

const recording = viewRecording();

/**
 * A short pane scrolled inside ISSUES: the heading held at the top with
 * the place of the first row shown under it and the group's size, the
 * counts line giving the selection's own place, and the last line
 * counting every row under the pane, the pull requests after the issues.
 */
export const OwedPinnedHeading: Story<ScreenFrameProps> = {
  args: {
    ...recording,
    owedGrouping: "kind",
    run: ["selection.next", "selection.next"],
  },
  parameters: { height: 14 },
};

/**
 * owed by owner after a page down: the selection on alice's last row,
 * her heading pinned with the place of the first row shown, and bob's
 * and the unassigned rows under the pane counted.
 */
export const OwedScrolled: Story<ScreenFrameProps> = {
  args: {
    ...recording,
    owedGrouping: "owner",
    run: ["selection.next", "selection.pageDown"],
  },
  parameters: { height: 14 },
};
