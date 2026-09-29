import { findEventLine } from "../../../../testing/activity.js";
import type { Meta, Story } from "../../../../testing/stories.js";
import EventLine from "./EventLine.js";
import type { EventLineProps } from "./types.js";

const meta: Meta<EventLineProps> = {
  title: "component/EventLine",
  component: EventLine,
};

export default meta;

/** Someone pushed to a pull request. */
export const Pushed: Story<EventLineProps> = {
  args: { line: findEventLine(12, 1), stacked: true, width: 40 },
};

/** A pull request's checks failed: a field in trouble. */
export const ChecksFailed: Story<EventLineProps> = {
  args: { line: findEventLine(12, 0), stacked: true, width: 40 },
};

/** A bot opened a pull request: context, dimmed. */
export const Bot: Story<EventLineProps> = {
  args: { line: findEventLine(14, 0), stacked: false, width: 40 },
};
