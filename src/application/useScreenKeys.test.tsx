import { useState } from "react";
import { describe, expect, it } from "vitest";
import { draw, type Screen, WithKeys } from "../testing/terminal.js";
import useScreenKeys, {
  type ScreenActions,
  type UseScreenKeysProps,
} from "./useScreenKeys.js";

/** The screen's state the keys read, which a test sets as the screen would. */
type State = Omit<UseScreenKeysProps, "actions">;

/**
 * Binds the keys on `start`, noting each action a key runs in `ran`, and
 * draws the keys that act now, then the keys of every command bound.
 */
function probe(start: Partial<State> = {}) {
  const ran: string[] = [];
  let change: (state: Partial<State>) => void = () => {};
  const note =
    (name: string) =>
    (...args: unknown[]) =>
      ran.push([name, ...args].join(" "));
  const actions: ScreenActions = {
    switchMode: note("switchMode"),
    moveSelection: note("moveSelection"),
    openSelected: note("openSelected"),
    nextGrouping: note("nextGrouping"),
    nextWindow: note("nextWindow"),
    toggleHelp: note("toggleHelp"),
    refresh: note("refresh"),
    quit: note("quit"),
  };
  function Probe() {
    const [state, setState] = useState<State>({ mode: "owed", ...start });
    change = (next) => setState((current) => ({ ...current, ...next }));
    const { active, bound } = useScreenKeys({ ...state, actions });
    return (
      <box flexDirection="column">
        <text>{active.flatMap(({ keys }) => keys).join(" ")}</text>
        <text>{bound.flatMap(({ keys }) => keys).join(" ")}</text>
      </box>
    );
  }
  return { ran, change: (state: Partial<State>) => change(state), Probe };
}

/** Presses `keys` one after another and reads the screen back. */
async function press(screen: Screen, ...keys: string[]) {
  let drawn = screen;
  for (const key of keys) {
    drawn = await drawn.redraw(() => {
      const input = screen.setup.mockInput;
      if (key === "left" || key === "right" || key === "up" || key === "down") {
        input.pressArrow(key);
      } else if (key === "return") input.pressEnter();
      else input.pressKey(key);
    });
  }
  return drawn;
}

/** Draws the probe with the terminal's keymap, 120 columns wide. */
async function bind(start: Partial<State> = {}) {
  const probed = probe(start);
  const { Probe } = probed;
  const screen = await draw(
    <WithKeys>
      <Probe />
    </WithKeys>,
    120,
    2,
  );
  return { ...probed, screen };
}

describe("useScreenKeys", () => {
  it("runs each key's action", async () => {
    const { ran, screen } = await bind();
    await press(
      screen,
      ...["left", "h", "right", "l", "up", "k", "down", "j", "return", "g"],
      ...["?", "R", "q"],
    );
    expect(ran).toEqual([
      "switchMode owed",
      "switchMode owed",
      "switchMode activity",
      "switchMode activity",
      "moveSelection -1",
      "moveSelection -1",
      "moveSelection 1",
      "moveSelection 1",
      "openSelected",
      "nextGrouping",
      "toggleHelp",
      "refresh",
      "quit",
    ]);
  });

  it("moves to the next time window in activity alone, while the help lists t in both modes", async () => {
    const { ran, change, screen } = await bind();
    const owed = await press(screen, "t");
    await screen.redraw(() => change({ mode: "activity" }));
    const activity = await press(screen, "t");
    expect(ran).toEqual(["nextWindow"]);
    expect([owed, activity].map(({ lines }) => lines)).toEqual([
      ["← → ↑ ↓ ⏎ g ? R q", "← → ↑ ↓ ⏎ g t ? R q"],
      ["← → ↑ ↓ ⏎ g t ? R q", "← → ↑ ↓ ⏎ g t ? R q"],
    ]);
  });
});
