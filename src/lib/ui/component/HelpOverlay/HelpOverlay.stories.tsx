import { everyCommand } from "../../../../testing/commands.js";
import type { Meta, Story } from "../../../../testing/stories.js";
import HelpOverlay from "./HelpOverlay.js";
import type { HelpOverlayProps } from "./types.js";

const meta: Meta<HelpOverlayProps> = {
  title: "component/HelpOverlay",
  component: HelpOverlay,
};

export default meta;

/** Every key bound, as `?` shows them, with room for them all. */
export const Keys: Story<HelpOverlayProps> = {
  args: {
    commands: everyCommand,
    note: "windows are counted in working time",
    width: 40,
    height: 36,
  },
};

/**
 * A pane too short for the help, scrolled into the list's keys: their
 * heading pinned with the place of the first key line shown, and the key
 * lines under the pane counted.
 */
export const Scrolled: Story<HelpOverlayProps> = {
  args: { ...Keys.args, height: 8, first: 5 },
  parameters: { height: 8 },
};
