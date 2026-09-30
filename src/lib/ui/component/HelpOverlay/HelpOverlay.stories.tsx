import { everyCommand, longCommands } from "../../../../testing/commands.js";
import type { Meta, Story } from "../../../../testing/stories.js";
import HelpOverlay from "./HelpOverlay.js";
import type { HelpOverlayProps } from "./types.js";

const meta: Meta<HelpOverlayProps> = {
  title: "component/HelpOverlay",
  component: HelpOverlay,
};

export default meta;

/** Every key bound, as `?` shows them. */
export const Keys: Story<HelpOverlayProps> = {
  args: {
    commands: everyCommand,
    note: { text: "windows are counted in working time", kind: "words" },
    width: 40,
  },
};

/** Every key, the thread's included, as many as the help lists. */
export const Long: Story<HelpOverlayProps> = {
  args: {
    commands: longCommands,
    note: { text: "windows are counted in working time", kind: "words" },
    width: 40,
  },
};
