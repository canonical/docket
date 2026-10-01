import {
  Component,
  type ReactNode,
  Suspense,
  use,
  useLayoutEffect,
} from "react";
import type { Verdict } from "../../../endings/index.js";
import type { WaitRow } from "../../../owed/index.js";
import { tokens } from "../../../tokens/index.js";
import { accordionMaxLines } from "../../constants.js";
import describeClock from "../../describeClock.js";
import trimText from "../../trimText.js";
import type { Piece } from "../../types.js";
import { marginCells } from "../Margin/constants.js";
import { Margin } from "../Margin/index.js";
import describeDetail, { type Reading } from "./describeDetail.js";
import fitAccordion from "./fitAccordion.js";
import type { ShownDetail, ThreadAccordionProps } from "./types.js";

/**
 * What the item's margin shows beside the accordion: the row's state and
 * stack, and whether the item ends with it, where the bar then stops.
 */
interface Stroke {
  readonly state?: WaitRow["state"] | Verdict;
  readonly stacked: boolean;
  readonly ends: boolean;
}

/**
 * The margin the item's bar and stack mark run down, from the row above:
 * the bar only where the list runs a clock. A finished thread's ending
 * follows its accordion, so its bar runs on past the accordion's last line.
 */
function findStroke(row: ThreadAccordionProps["row"], clock: boolean): Stroke {
  if ("wait" in row) {
    return {
      ...(clock ? { state: row.state } : {}),
      stacked: row.stacked,
      ends: true,
    };
  }
  if ("ending" in row) {
    return {
      ...(clock && row.verdict ? { state: row.verdict } : {}),
      stacked: row.stacked,
      ends: false,
    };
  }
  return { stacked: row.thread.stack !== undefined, ends: true };
}

/**
 * Draws the lines given with the item's margin beside them, the bar
 * ending on the last line, all on the selection's background: the
 * accordion belongs to the selected item. Tells `onLines`, when given,
 * how many lines it drew.
 */
const Lines = ({
  lines,
  stroke,
  onLines,
}: {
  readonly lines: readonly (readonly Piece[])[];
  readonly stroke: Stroke;
  readonly onLines?: ThreadAccordionProps["onLines"];
}): ReactNode => {
  // The renderer paints before React runs passive effects, so the count is
  // told during the commit and the list scrolls before the frame is painted.
  useLayoutEffect(() => onLines?.(lines.length));
  return (
    <box
      flexDirection="row"
      flexShrink={0}
      backgroundColor={tokens["color.background.selected"]}
    >
      <Margin {...stroke} lines={lines.length} />
      <box flexDirection="column">
        {lines.map((line, place) => (
          // The accordion's lines never reorder, so their place is their key.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <text key={place}>
            {line.map(({ text, fg }, run) => (
              // A line's runs never reorder, so their place is their key.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above.
              <span key={run} fg={fg}>
                {text}
              </span>
            ))}
          </text>
        ))}
      </box>
    </box>
  );
};

/**
 * The details, once they have arrived, filling the snapshot's lines in
 * place, or, while reading is paused, what the snapshot holds or when
 * reading resumes.
 */
const Loaded = ({
  detail,
  row,
  reading,
  room,
  stroke,
  onLines,
}: {
  readonly detail: Promise<ShownDetail>;
  readonly row: ThreadAccordionProps["row"];
  readonly reading: Reading;
  readonly room: number;
  readonly stroke: Stroke;
  readonly onLines: ThreadAccordionProps["onLines"];
}): ReactNode => {
  const shown = use(detail);
  if ("resumes" in shown) {
    const paused = `paused · resumes ${describeClock(shown.resumes, reading.timezone)}`;
    return (
      <Lines
        lines={[
          [{ text: trimText(paused, room), fg: tokens["color.text.muted"] }],
        ]}
        stroke={stroke}
        onLines={onLines}
      />
    );
  }
  return (
    <Lines
      lines={fitAccordion(describeDetail(row, shown, reading), room)}
      stroke={stroke}
      onLines={onLines}
    />
  );
};

interface BoundaryProps {
  readonly detail: Promise<ShownDetail>;
  /** What the snapshot shows, above the reason when the read fails. */
  readonly snapshot: ThreadAccordionProps["row"];
  readonly reading: Reading;
  readonly room: number;
  readonly stroke: Stroke;
  readonly onLines: ThreadAccordionProps["onLines"];
  readonly children: ReactNode;
}

interface BoundaryState {
  readonly detail: Promise<ShownDetail>;
  readonly failure?: unknown;
}

/**
 * Adds the reason under what the snapshot shows when reading the details
 * fails, and forgets the failure once the accordion is given other
 * details, so a later read of the same thread gets its own chance. A
 * thread the snapshot holds nothing of shows the reason alone.
 */
class Boundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { detail: this.props.detail };

  static getDerivedStateFromProps(
    props: BoundaryProps,
    state: BoundaryState,
  ): BoundaryState | null {
    return props.detail === state.detail
      ? null
      : { detail: props.detail, failure: undefined };
  }

  static getDerivedStateFromError(failure: unknown): Partial<BoundaryState> {
    return { failure };
  }

  override render(): ReactNode {
    const { failure } = this.state;
    if (failure === undefined) return this.props.children;
    const { snapshot, reading, room, stroke, onLines } = this.props;
    const reason =
      failure instanceof Error
        ? failure.message.replace(/\.$/, "")
        : String(failure);
    const failed: Piece = {
      text: trimText(`${tokens["glyph.failed"]} failed: ${reason}`, room),
      fg: tokens["color.text.error"],
    };
    // A thread the snapshot holds, owed's wait or a finished one, keeps
    // its lines above the reason.
    const shown =
      "wait" in snapshot || "ending" in snapshot
        ? fitAccordion(
            describeDetail(snapshot, undefined, reading),
            room,
            accordionMaxLines - 1,
          )
        : [];
    return (
      <Lines lines={[...shown, [failed]]} stroke={stroke} onLines={onLines} />
    );
  }
}

/**
 * The detail that opens under the selected row. Only one is open at a
 * time, and the selected row stays anchored above it. It is as tall as
 * its content, at most eight lines, and wrapped to the pane beside the
 * item's margin, whose bar runs down from the row and ends on its last
 * line, or, under a finished thread, runs on to its ending. Its lines come from the snapshot at once, so the list makes room
 * for them before any read; a line the details complete ends in a dimmed
 * `…` and grows in place when they arrive, and nothing blanks or changes
 * height meanwhile. It reads its details from GitHub, so a slow read
 * never holds up moving the selection, and a failed one adds its reason
 * as one line under what the snapshot showed. While reading is paused
 * it shows what the snapshot holds, as it does while a read is under way,
 * and for a thread the snapshot holds nothing of, `paused · resumes 13:00`,
 * dimmed. Details that make it taller than the snapshot's lines, such as
 * a closed thread's close body or a failed read's line, are told through
 * `onLines`, so the list can make room. The thread's content wears no
 * state mark: docket's own words about it are dimmed, and each login
 * carries its group's mark and hue.
 *
 * `import { ThreadAccordion } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.thread_accordion
 */
const ThreadAccordion = ({
  row,
  detail,
  waiting,
  clock,
  now,
  timezone,
  width,
  onLines,
}: ThreadAccordionProps): ReactNode => {
  const reading = { now, timezone, waiting };
  const room = width - marginCells;
  const stroke = findStroke(row, clock);
  if (!detail) {
    return (
      <Lines
        lines={fitAccordion(describeDetail(row, undefined, reading), room)}
        stroke={stroke}
        onLines={onLines}
      />
    );
  }
  return (
    <Boundary
      detail={detail}
      snapshot={row}
      reading={reading}
      room={room}
      stroke={stroke}
      onLines={onLines}
    >
      <Suspense
        fallback={
          <Lines
            lines={fitAccordion(describeDetail(row, undefined, reading), room)}
            stroke={stroke}
          />
        }
      >
        <Loaded
          detail={detail}
          row={row}
          reading={reading}
          room={room}
          stroke={stroke}
          onLines={onLines}
        />
      </Suspense>
    </Boundary>
  );
};

export default ThreadAccordion;
