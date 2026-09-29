import {
  type CliRenderer,
  type CliRendererConfig,
  createCliRenderer,
} from "@opentui/core";
import { KeymapProvider } from "@opentui/keymap/react";
import { createRoot } from "@opentui/react";
import { createAttention, startRefreshCycle } from "../lib/cache/index.js";
import { createKeymap } from "../lib/ui/index.js";
import Screen from "./Screen.js";
import type { TerminalView } from "./types.js";

/**
 * Opens the terminal interface on `view` and keeps the cache refreshing
 * while it is open, as the pane's attention sets the pace: every key the
 * screen hears counts. The refresh cycle starts here and nowhere else, so
 * text mode never refreshes in the background. `q`, or ctrl+c, closes it,
 * and the React tree unmounts with the renderer.
 *
 * @note Impure: takes over the terminal, and sets timers and watches the
 * cache folder until it is closed.
 * @param createRenderer Makes the renderer the interface draws on.
 * @returns 0, once the interface is closed.
 */
export default async function openTerminal(
  view: TerminalView,
  createRenderer: (
    config: CliRendererConfig,
  ) => Promise<CliRenderer> = createCliRenderer,
): Promise<number> {
  const { promise, resolve } = Promise.withResolvers<number>();
  let stop = () => {};
  const renderer = await createRenderer({
    exitOnCtrlC: true,
    onDestroy: () => {
      stop();
      resolve(0);
    },
  });
  const keymap = createKeymap(renderer);
  const attention = "cache" in view.source ? createAttention() : undefined;
  createRoot(renderer).render(
    <KeymapProvider keymap={keymap}>
      <Screen
        {...view}
        {...(attention && { attention })}
        onQuit={() => renderer.destroy()}
      />
    </KeymapProvider>,
  );
  if ("cache" in view.source && attention) {
    const stopCycle = startRefreshCycle(view.source.cache, attention);
    stop = () => {
      stopCycle();
      attention.stop();
    };
  }
  return promise;
}
