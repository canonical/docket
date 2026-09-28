import {
  activityCommands,
  owedCommands,
} from "../../../../testing/commands.js";
import type { Meta, Story } from "../../../../testing/stories.js";
import KeyBar from "./KeyBar.js";
import type { KeyBarProps } from "./types.js";

const meta: Meta<KeyBarProps> = {
  title: "component/KeyBar",
  component: KeyBar,
};

export default meta;

/** The keys of owed. */
export const Owed: Story<KeyBarProps> = {
  args: { commands: owedCommands, width: 40 },
};

/** The keys of activity, with the time window. */
export const Activity: Story<KeyBarProps> = {
  args: { commands: activityCommands, width: 40 },
};
