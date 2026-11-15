import type { Meta, StoryObj } from "@aztlan/lago-react";
import { everyCommand, longCommands } from "../../../../testing/commands.js";
import { atHeight, drawAtWidth } from "../../../../testing/stories.js";
import HelpOverlay from "./HelpOverlay.js";

const meta = {
  title: "component/HelpOverlay",
  component: HelpOverlay,
  render: drawAtWidth(HelpOverlay),
} satisfies Meta<typeof HelpOverlay>;

export default meta;

/** Every key bound, as `?` shows them, with room for them all. */
export const Keys: StoryObj<typeof meta> = {
  args: {
    commands: everyCommand,
    note: { text: "windows are counted in working time", kind: "words" },
    width: 40,
    height: 36,
  },
};

/** Every key, the thread's included, as many as the help lists. */
export const Long: StoryObj<typeof meta> = {
  args: {
    commands: longCommands,
    note: { text: "windows are counted in working time", kind: "words" },
    width: 40,
    height: 36,
  },
};

/**
 * A pane too short for the help, scrolled into the list's keys: their
 * heading pinned with the place of the first key line shown, and the key
 * lines under the pane counted.
 */
export const Scrolled: StoryObj<typeof meta> = {
  args: { ...Keys.args, height: 8, first: 5 },
  parameters: { viewports: atHeight(8) },
};
