import { longCommands, owedCommands } from "../../../../testing/commands.js";
import type { Meta, Story } from "../../../../testing/stories.js";
import {
  CountsLine,
  EmptyState,
  HelpOverlay,
  KeyBar,
  StatusLine,
} from "../../component/index.js";
import { PaneHeader } from "../../subcomponent/index.js";
import Pane from "./Pane.js";
import type { PaneProps } from "./types.js";

const meta: Meta<PaneProps> = {
  title: "layout/Pane",
  component: Pane,
};

export default meta;

const width = 40;
/** The approved frames' height. */
const height = 36;

/** owed with nothing owed: every line of the screen. */
export const NothingOwed: Story<PaneProps> = {
  args: {
    width,
    height,
    header: (
      <PaneHeader title={{ text: "owed", kind: "words" }} width={width} />
    ),
    children: (
      <box paddingTop={1}>
        <EmptyState
          message={{ text: "nothing owed", kind: "words" }}
          width={width}
        />
      </box>
    ),
    counts: (
      <CountsLine
        summary={{
          fields: [
            { text: "0 over", kind: "words" },
            { text: "0 soon", kind: "words" },
            { text: "0 on track", kind: "words" },
          ],
        }}
        width={width}
      />
    ),
    status: (
      <StatusLine
        status={{
          syncedAt: new Date("2026-09-28T11:58:00Z"),
          refreshing: false,
          whole: false,
          stages: [],
          fullRefreshAvailableAt: undefined,
          paused: undefined,
          failure: undefined,
        }}
        now={new Date("2026-09-28T12:00:00Z")}
        timezone="UTC"
        names={{}}
        width={width}
      />
    ),
    keys: <KeyBar commands={owedCommands} width={width} />,
  },
};

/** The help open: it fills the pane under the header. */
export const Help: Story<PaneProps> = {
  args: {
    ...NothingOwed.args,
    header: (
      <PaneHeader title={{ text: "help", kind: "words" }} width={width} />
    ),
    help: (
      <HelpOverlay
        commands={owedCommands}
        note={{ text: "windows are counted in working time", kind: "words" }}
        width={width}
        height={height - 1}
      />
    ),
  },
};

/** No counts line: its place stays blank. */
export const NoCounts: Story<PaneProps> = {
  args: { ...NothingOwed.args, counts: undefined },
};

/**
 * Every line of the pane with more than 40 columns hold: an editor's
 * header on a repository with a long short name, the widest counts, and
 * more keys than the bar holds.
 */
export const Long: Story<PaneProps> = {
  args: {
    ...NothingOwed.args,
    header: (
      <PaneHeader
        title={{
          text: "assigning example-repository-with-a-long-name#12345",
          kind: "identifier",
        }}
        width={width}
      />
    ),
    counts: (
      <CountsLine
        summary={{
          fields: ["9999 over", "9999 soon", "9999 on track"].map((text) => ({
            text,
            kind: "words" as const,
          })),
        }}
        width={width}
      />
    ),
    keys: <KeyBar commands={longCommands} width={width} />,
  },
};
