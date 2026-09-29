import { Component, type ReactNode, Suspense, use } from "react";
import type { WaitRow } from "../../../owed/index.js";
import { tokens } from "../../../tokens/index.js";
import { accordionHeight as height } from "../../constants.js";
import describeClock from "../../describeClock.js";
import trimText from "../../trimText.js";
import wrapText from "../../wrapText.js";
import { marginCells as indent } from "../Margin/constants.js";
import { Margin } from "../Margin/index.js";
import describeDetail from "./describeDetail.js";
import type { DetailLine, ShownDetail, ThreadAccordionProps } from "./types.js";

const tones: Readonly<Record<DetailLine["tone"], string>> = {
  text: tokens["color.text"],
  error: tokens["color.text.error"],
  muted: tokens["color.text.muted"],
};

/** A line on screen, fitted, in its colour. */
interface Drawn {
  readonly text: string;
  readonly fg: string;
  /** Ends in a dimmed `…`, for the rest the details read would give. */
  readonly pending?: boolean;
}

/**
 * The lines of one piece, wrapped to `room`; a pending piece keeps two
 * cells on its last line for its `…`.
 */
function wrapPiece(piece: DetailLine, room: number): Drawn[] {
  const fg = tones[piece.tone];
  if (!piece.pending) {
    return wrapText(piece.text, room).map((text) => ({ text, fg }));
  }
  const wrapped = piece.text ? wrapText(piece.text, room - 2) : [""];
  return wrapped.map((text, place) => ({
    text,
    fg,
    pending: place === wrapped.length - 1,
  }));
}

/**
 * Fits the body into the lines the stack lines leave, each piece wrapped
 * to `room`. A piece marked optional is shown only when it fits whole.
 * Content past the last line is cut, and only the last line kept ends in
 * `…`.
 */
function fitBody(
  body: readonly DetailLine[],
  lines: number,
  room: number,
): Drawn[] {
  const drawn: Drawn[] = [];
  for (const piece of body) {
    const wrapped = wrapPiece(piece, room);
    const left = lines - drawn.length;
    if (wrapped.length <= left) {
      drawn.push(...wrapped);
    } else if (!piece.optional) {
      const kept = [...drawn, ...wrapped.slice(0, left)];
      const ended = kept.slice(-1).map((last) => ({
        text: trimText(`${last.text}…`, room),
        fg: last.fg,
      }));
      return [...kept.slice(0, -1), ...ended];
    }
  }
  return drawn;
}

/** What the item's margin shows beside the accordion: the row's state and stack. */
interface Stroke {
  readonly state?: WaitRow["state"];
  readonly stacked: boolean;
}

/**
 * The margin the item's bar and stack mark run down, from the row above:
 * the bar only where the list runs a clock.
 */
const findStroke = (
  row: ThreadAccordionProps["row"],
  clock: boolean,
): Stroke =>
  "wait" in row
    ? { ...(clock ? { state: row.state } : {}), stacked: row.stacked }
    : { stacked: row.thread.stack !== undefined };

/**
 * Draws the lines given, then blank lines to the accordion's height, with
 * the item's margin beside them, its bar ending on the last line.
 */
const Lines = ({
  lines,
  stroke,
}: {
  readonly lines: readonly Drawn[];
  readonly stroke: Stroke;
}): ReactNode => (
  <box flexDirection="row" height={height} flexShrink={0}>
    <Margin {...stroke} lines={height} ends />
    <box flexDirection="column">
      {Array.from({ length: height }, (_, place) => {
        const drawn = lines.at(place);
        return (
          // The accordion's lines never reorder, so their place is their key.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <text key={place} fg={drawn?.fg ?? tokens["color.text"]}>
            {drawn?.text ?? ""}
            {drawn?.pending && (
              <span fg={tokens["color.text.muted"]}>
                {drawn.text ? " …" : "…"}
              </span>
            )}
          </text>
        );
      })}
    </box>
  </box>
);

/** The details, once they have arrived, fitted to the five lines. */
const Loaded = ({
  row,
  clock,
  detail,
  waiting,
  now,
  timezone,
  width,
}: ThreadAccordionProps): ReactNode => {
  const room = width - indent;
  const shown = use(detail);
  if ("resumes" in shown) {
    const paused = `paused · resumes ${describeClock(shown.resumes, timezone)}`;
    return (
      <Lines
        lines={[
          { text: trimText(paused, room), fg: tokens["color.text.muted"] },
        ]}
        stroke={findStroke(row, clock)}
      />
    );
  }
  const { body, stack } = describeDetail(row, shown, {
    now,
    timezone,
    waiting,
  });
  const stackLines = stack.flatMap((piece) =>
    piece.pending
      ? wrapPiece(piece, room)
      : [{ text: trimText(piece.text, room), fg: tones[piece.tone] }],
  );
  const lines = fitBody(body, height - stackLines.length, room);
  return (
    <Lines lines={[...lines, ...stackLines]} stroke={findStroke(row, clock)} />
  );
};

interface BoundaryProps {
  readonly detail: Promise<ShownDetail>;
  readonly stroke: Stroke;
  readonly width: number;
  readonly children: ReactNode;
}

interface BoundaryState {
  readonly detail: Promise<ShownDetail>;
  readonly failure?: unknown;
}

/**
 * Stands the reason in for the details when reading them fails, and
 * forgets the failure once the accordion is given other details, so a
 * later read of the same thread gets its own chance.
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
    const reason =
      failure instanceof Error
        ? failure.message.replace(/\.$/, "")
        : String(failure);
    const room = this.props.width - indent;
    const failed = { text: `✗ failed: ${reason}`, tone: "error" } as const;
    return (
      <Lines
        lines={fitBody([failed], height, room)}
        stroke={this.props.stroke}
      />
    );
  }
}

/**
 * The detail that opens under the selected row. Only one is open at a
 * time, and the selected row stays anchored above it. It is always
 * exactly five lines tall, whatever it holds, and wrapped to the pane
 * beside the item's margin, whose bar runs down from the row and ends on
 * its last line. It
 * reads its details from GitHub, so it has its own loading and failed
 * states, and a slow read never holds up moving the selection. While
 * reading is paused it shows what the snapshot holds, each line that needs
 * the read ending in a dimmed `…`, and for a thread the snapshot holds
 * nothing of, `paused · resumes 13:00`, dimmed.
 *
 * `import { ThreadAccordion } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.thread_accordion
 */
const ThreadAccordion = ({
  detail,
  width,
  ...props
}: ThreadAccordionProps): ReactNode => {
  const stroke = findStroke(props.row, props.clock);
  return (
    <Boundary detail={detail} stroke={stroke} width={width}>
      <Suspense
        fallback={
          <Lines
            lines={[{ text: "loading…", fg: tokens["color.text"] }]}
            stroke={stroke}
          />
        }
      >
        <Loaded detail={detail} width={width} {...props} />
      </Suspense>
    </Boundary>
  );
};

export default ThreadAccordion;
