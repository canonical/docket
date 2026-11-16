import type { Meta, StoryObj } from "@aztlan/lago-react";
import {
  activityCommands,
  longCommands,
  owedCommands,
} from "../../../../testing/commands.js";
import { drawAtWidth } from "../../../../testing/stories.js";
import KeyBar from "./KeyBar.js";

const meta = {
  title: "component/KeyBar",
  component: KeyBar,
  render: drawAtWidth(KeyBar),
} satisfies Meta<typeof KeyBar>;

export default meta;

/** The keys of owed. */
export const Owed: StoryObj<typeof meta> = {
  args: { commands: owedCommands, width: 40 },
};

/** The keys of activity, with the time window. */
export const Activity: StoryObj<typeof meta> = {
  args: { commands: activityCommands, width: 40 },
};

/**
 * More keys than 40 columns hold: activity's, with the thread's keys and
 * the full refresh's.
 */
export const Long: StoryObj<typeof meta> = {
  args: { commands: longCommands, width: 40 },
};
