import { findEventLine } from "../../../../testing/activity.js";
import { findFinishedRow } from "../../../../testing/finished.js";
import { longEvent } from "../../../../testing/long.js";
import type { Meta, Story } from "../../../../testing/stories.js";
import EventLine from "./EventLine.js";
import type { EventLineProps } from "./types.js";

const meta: Meta<EventLineProps> = {
  title: "component/EventLine",
  component: EventLine,
};

export default meta;

/** Someone pushed to a pull request. */
export const Pushed = {
  args: { line: findEventLine(12, 1), stacked: true, width: 40 },
} satisfies Story<EventLineProps>;

/** A pull request's checks failed: a field in trouble. */
export const ChecksFailed = {
  args: { line: findEventLine(12, 0), stacked: true, width: 40 },
} satisfies Story<EventLineProps>;

/** A bot opened a pull request: context, dimmed. */
export const Bot = {
  args: { line: findEventLine(14, 0), stacked: false, width: 40 },
} satisfies Story<EventLineProps>;

/** A finished issue's ending, past its target: the heavy bar ends on it. */
export const EndingOver = {
  args: {
    line: findFinishedRow("example#7").ending,
    state: "over",
    stacked: false,
    width: 40,
  },
} satisfies Story<EventLineProps>;

/** A stacked pull request's ending, within its target: the light bar ends on it. */
export const EndingWithin = {
  args: {
    line: findFinishedRow("example#2").ending,
    state: "within",
    stacked: true,
    width: 40,
  },
} satisfies Story<EventLineProps>;

/** Someone with a long login labelled a pull request with a long label. */
export const Long = {
  args: { line: longEvent, stacked: true, width: 40 },
} satisfies Story<EventLineProps>;
