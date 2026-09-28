import { Component, type ReactNode, Suspense, use } from "react";
import type { ThreadDetail } from "../../../provider/index.js";
import { tokens } from "../../../tokens/index.js";
import trimText from "../../trimText.js";
import wrapText from "../../wrapText.js";
import describeDetail from "./describeDetail.js";
import type { DetailLine, ThreadAccordionProps } from "./types.js";

/** The accordion's height, in lines, whatever it holds. */
const height = 5;

/** The indent of its text, so it starts under the row's reference. */
const indent = 2;

const tones: Readonly<Record<DetailLine["tone"], string>> = {
  text: tokens["color.text"],
  error: tokens["color.text.error"],
  muted: tokens["color.text.muted"],
};

/** A line on screen, fitted, in its colour. */
interface Drawn {
  readonly text: string;
  readonly fg: string;
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
    const wrapped = wrapText(piece.text, room).map((text) => ({
      text,
      fg: tones[piece.tone],
    }));
    const left = lines - drawn.length;
    if (wrapped.length <= left) {
      drawn.push(...wrapped);
    } else if (!piece.optional) {
      const kept = [...drawn, ...wrapped.slice(0, left)];
      const ended = kept
        .slice(-1)
        .map((last) => ({ ...last, text: trimText(`${last.text}…`, room) }));
      return [...kept.slice(0, -1), ...ended];
    }
  }
  return drawn;
}

/** Draws the lines given, then blank lines to the accordion's height. */
const Lines = ({ lines }: { readonly lines: readonly Drawn[] }): ReactNode => (
  <box flexDirection="column" height={height} flexShrink={0}>
    {Array.from({ length: height }, (_, place) => {
      const drawn = lines.at(place);
      return (
        // The accordion's lines never reorder, so their place is their key.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above.
        <text key={place} fg={drawn?.fg ?? tokens["color.text"]}>
          {drawn ? `${" ".repeat(indent)}${drawn.text}` : ""}
        </text>
      );
    })}
  </box>
);

/** The details, once they have arrived, fitted to the five lines. */
const Loaded = ({
  row,
  detail,
  waiting,
  now,
  timezone,
  width,
}: ThreadAccordionProps): ReactNode => {
  const room = width - indent;
  const { body, stack } = describeDetail(row, use(detail), {
    now,
    timezone,
    waiting,
  });
  const stackLines = stack.map(({ text, tone }) => ({
    text: trimText(text, room),
    fg: tones[tone],
  }));
  const lines = fitBody(body, height - stackLines.length, room);
  return <Lines lines={[...lines, ...stackLines]} />;
};

interface BoundaryProps {
  readonly detail: Promise<ThreadDetail>;
  readonly width: number;
  readonly children: ReactNode;
}

interface BoundaryState {
  readonly detail: Promise<ThreadDetail>;
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
    return <Lines lines={fitBody([failed], height, room)} />;
  }
}

/**
 * The detail that opens under the selected row. Only one is open at a
 * time, and the selected row stays anchored above it. It is always
 * exactly five lines tall, whatever it holds, indented two cells so its
 * text starts under the row's reference, and wrapped to the pane. It
 * reads its details from GitHub, so it has its own loading and failed
 * states, and a slow read never holds up moving the selection.
 *
 * `import { ThreadAccordion } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.thread_accordion
 */
const ThreadAccordion = ({
  detail,
  width,
  ...props
}: ThreadAccordionProps): ReactNode => (
  <Boundary detail={detail} width={width}>
    <Suspense
      fallback={
        <Lines lines={[{ text: "loading…", fg: tokens["color.text"] }]} />
      }
    >
      <Loaded detail={detail} width={width} {...props} />
    </Suspense>
  </Boundary>
);

export default ThreadAccordion;
