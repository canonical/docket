/**
 * Draws a component with OpenTUI's test renderer and reads the screen
 * back: the characters of each line, and the colours and weight of the
 * text on it. Every screen drawn is destroyed after its test.
 */

import { type CapturedSpan, TextAttributes } from "@opentui/core";
import type { TestRendererSetup } from "@opentui/core/testing";
import { KeymapProvider } from "@opentui/keymap/react";
import { useRenderer } from "@opentui/react";
import { testRender } from "@opentui/react/test-utils";
import { act, type ReactNode, useMemo, useState } from "react";
import { afterEach } from "vitest";
import createKeymap from "../lib/ui/createKeymap.js";

/** What a drawn screen shows. */
export interface Screen {
  /** The characters of each line, without the spaces that end it. */
  readonly lines: readonly string[];
  /** How the first run of text containing `text` is drawn. */
  readonly look: (text: string) => Look | undefined;
  /**
   * Runs `action`, such as a key press, as React expects under test, lets
   * every update it causes settle, and reads the screen back.
   */
  readonly redraw: (action?: () => void) => Promise<Screen>;
  readonly setup: TestRendererSetup;
}

/** The colours and weight of a run of text, colours as `#rrggbb`. */
export interface Look {
  readonly fg: string;
  readonly bg: string;
  readonly bold: boolean;
}

const drawn: TestRendererSetup[] = [];

afterEach(() => {
  for (const setup of drawn.splice(0)) setup.renderer.destroy();
});

const hex = (colour: CapturedSpan["fg"]) =>
  `#${colour
    .toInts()
    .slice(0, 3)
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;

function read(setup: TestRendererSetup): Screen {
  const lines = setup
    .captureCharFrame()
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => line.trimEnd());
  const spans = setup.captureSpans().lines.flatMap((line) => line.spans);
  return {
    lines,
    look: (text) => {
      const span = spans.find((each) => each.text.includes(text));
      return (
        span && {
          fg: hex(span.fg),
          bg: hex(span.bg),
          bold: (span.attributes & TextAttributes.BOLD) !== 0,
        }
      );
    },
    redraw: async (action) => {
      await act(async () => {
        action?.();
        await setup.flush();
      });
      await setup.renderOnce();
      return read(setup);
    },
    setup,
  };
}

/** Draws `node` on a screen of `width` columns and `height` lines. */
export async function draw(
  node: ReactNode,
  width: number,
  height = 12,
): Promise<Screen> {
  // A frame is drawn as soon as one is asked for. At the renderer's cap
  // of 60 a second, each read of the screen waits up to 17 ms for its
  // frame, which a busy machine stretches into seconds over a test.
  const setup = await testRender(node, { width, height, maxFps: 1_000 });
  drawn.push(setup);
  await setup.renderOnce();
  return read(setup);
}

/**
 * Draws `node` as `draw` does, but mounts it inside an awaited `act`, as
 * React needs for a component that suspends, such as one that waits on
 * details from GitHub: `draw` mounts at once, and React never retries a
 * boundary that suspended during that first mount.
 */
export async function drawSuspending(
  node: ReactNode,
  width: number,
  height = 12,
): Promise<Screen> {
  let mount = () => {};
  const Later = () => {
    const [shown, setShown] = useState(false);
    mount = () => setShown(true);
    return shown ? node : null;
  };
  const screen = await draw(<Later />, width, height);
  return screen.redraw(() => mount());
}

/**
 * Gives `children` the keymap the terminal interface uses, on the
 * renderer they are drawn with.
 */
export function WithKeys({ children }: { children: ReactNode }) {
  const renderer = useRenderer();
  const keymap = useMemo(() => createKeymap(renderer), [renderer]);
  return <KeymapProvider keymap={keymap}>{children}</KeymapProvider>;
}
