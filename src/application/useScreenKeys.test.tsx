import { useState } from "react";
import { describe, expect, it } from "vitest";
import { draw, type Screen, WithKeys } from "../testing/terminal.js";
import useScreenKeys, {
  type ScreenActions,
  type UseScreenKeysProps,
} from "./useScreenKeys.js";

/** The screen's state and actions, which a test sets as the screen would. */
type State = UseScreenKeysProps;

/** Actions that each note their call in `ran`, after `label` when given. */
function noting(ran: string[], label?: string): ScreenActions {
  const note =
    (name: string) =>
    (...args: unknown[]) =>
      ran.push([label, name, ...args].filter(Boolean).join(" "));
  return {
    switchMode: note("switchMode"),
    moveSelection: note("moveSelection"),
    openSelected: note("openSelected"),
    nextGrouping: note("nextGrouping"),
    nextWindow: note("nextWindow"),
    edit: note("edit"),
    toggleHelp: note("toggleHelp"),
    closeHelp: note("closeHelp"),
    refresh: note("refresh"),
    quit: note("quit"),
  };
}

/**
 * Binds the keys on `start`, noting each action a key runs in `ran`, and
 * draws the keys that act now, the keys of every command bound, and the
 * groups of those commands, each once, in the order the help lists them.
 */
function probe(start: Partial<State> = {}) {
  const ran: string[] = [];
  let change: (state: Partial<State>) => void = () => {};
  function Probe() {
    const [state, setState] = useState<State>({
      mode: "owed",
      help: false,
      editorOpen: false,
      actions: noting(ran),
      ...start,
    });
    change = (next) => setState((current) => ({ ...current, ...next }));
    const { active, bound } = useScreenKeys(state);
    const groups = bound
      .map(({ group }) => group)
      .filter((group, place, all) => all.indexOf(group) === place);
    return (
      <box flexDirection="column">
        <text>{active.flatMap(({ keys }) => keys).join(" ")}</text>
        <text>{bound.flatMap(({ keys }) => keys).join(" ")}</text>
        <text>{groups.join(" ")}</text>
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
      else if (key === "escape") input.pressEscape();
      else input.pressKey(key);
    });
    // The input reads a lone escape only once no sequence follows it.
    if (key === "escape") {
      await new Promise((resolve) => setTimeout(resolve, 50));
      drawn = await drawn.redraw();
    }
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
    3,
  );
  return { ...probed, screen };
}

describe("useScreenKeys", () => {
  it("runs each key's action", async () => {
    const { ran, screen } = await bind();
    await press(
      screen,
      ...["left", "h", "right", "l", "up", "k", "down", "j", "return", "g"],
      ...["a", "r", "?", "R", "q"],
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
      "edit assign",
      "edit review",
      "toggleHelp",
      "refresh",
      "quit",
    ]);
  });

  it("moves to the next time window in activity alone, and opens an editor in either mode, while the help lists every key in both modes", async () => {
    const { ran, change, screen } = await bind();
    const owed = await press(screen, "t");
    await screen.redraw(() => change({ mode: "activity" }));
    const activity = await press(screen, "t", "a", "r");
    expect(ran).toEqual(["nextWindow", "edit assign", "edit review"]);
    expect([owed, activity].map(({ lines }) => lines.slice(0, 2))).toEqual([
      ["← → ↑ ↓ ⏎ g a r ? R q", "← → g t ↑ ↓ ⏎ a r ? esc R q"],
      ["← → ↑ ↓ ⏎ g t a r ? R q", "← → g t ↑ ↓ ⏎ a r ? esc R q"],
    ]);
  });

  it("runs the actions the screen gave last, though nothing else changed", async () => {
    const { ran, change, screen } = await bind();
    await screen.redraw(() => change({ actions: noting(ran, "later") }));
    await press(screen, "a", "g");
    expect(ran).toEqual(["later edit assign", "later nextGrouping"]);
  });

  it("closes the help with esc only while it is open", async () => {
    const { ran, change, screen } = await bind();
    await press(screen, "escape");
    await screen.redraw(() => change({ help: true }));
    await press(screen, "escape");
    expect(ran).toEqual(["closeHelp"]);
  });

  it("runs only the help's keys while an editor is open", async () => {
    const { ran, screen } = await bind({ editorOpen: true, help: true });
    const drawn = await press(screen, "j", "a", "q", "R", "?", "escape");
    expect(ran).toEqual(["toggleHelp", "closeHelp"]);
    expect(drawn.lines.at(0)).toBe("? esc");
  });

  it("lists the groups in the help's order, from the mode down to the app", async () => {
    const { screen } = await bind();
    expect(screen.lines.at(2)).toBe("Mode List Thread App");
  });
});
