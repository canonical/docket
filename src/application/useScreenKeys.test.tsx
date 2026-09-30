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
    movePage: note("movePage"),
    moveToEnd: note("moveToEnd"),
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
      tooSmall: false,
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

/**
 * What the terminal sends for a key the mock input names no helper for:
 * the page keys as their escape sequences, home and end by their names.
 */
const sequences: Readonly<Record<string, string>> = {
  pageup: "\u001B[5~",
  pagedown: "\u001B[6~",
  home: "HOME",
  end: "END",
};

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
      else input.pressKey(sequences[key] ?? key);
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
      ...["left", "h", "right", "l", "up", "k", "down", "j"],
      ...["pageup", "pagedown", "home", "end", "return", "g"],
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
      "movePage -1",
      "movePage 1",
      "moveToEnd -1",
      "moveToEnd 1",
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
      [
        "← → ↑ ↓ ⇞ ⇟ home end ⏎ g a r ? R q",
        "← → g t ↑ ↓ ⇞ ⇟ home end ⏎ a r ? esc R q",
      ],
      [
        "← → ↑ ↓ ⇞ ⇟ home end ⏎ g t a r ? R q",
        "← → g t ↑ ↓ ⇞ ⇟ home end ⏎ a r ? esc R q",
      ],
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

  it("runs only the help's keys, the movement keys, which scroll it, and q while the help shows, and every key again once it closes", async () => {
    const { ran, change, screen } = await bind({
      mode: "activity",
      help: true,
    });
    await press(
      screen,
      ...["left", "h", "right", "l", "up", "k", "down", "j"],
      ...["pageup", "pagedown", "home", "end", "return", "a", "r", "g", "t"],
      ...["R", "q", "?", "escape"],
    );
    expect(ran).toEqual([
      "moveSelection -1",
      "moveSelection -1",
      "moveSelection 1",
      "moveSelection 1",
      "movePage -1",
      "movePage 1",
      "moveToEnd -1",
      "moveToEnd 1",
      "quit",
      "toggleHelp",
      "closeHelp",
    ]);
    await screen.redraw(() => change({ help: false }));
    await press(screen, "j", "t");
    expect(ran.slice(11)).toEqual(["moveSelection 1", "nextWindow"]);
  });

  it("runs only the help's keys, and the movement keys once the help covers it, while an editor is open", async () => {
    const { ran, screen } = await bind({ editorOpen: true, help: true });
    const drawn = await press(
      screen,
      ...["j", "pagedown", "home", "a", "q", "R", "?", "escape"],
    );
    expect(ran).toEqual([
      "moveSelection 1",
      "movePage 1",
      "moveToEnd -1",
      "toggleHelp",
      "closeHelp",
    ]);
    expect(drawn.lines.at(0)).toBe("↑ ↓ ⇞ ⇟ home end ? esc");
  });

  it.each([
    { shown: "nothing open", help: false, editorOpen: false },
    { shown: "the help open", help: true, editorOpen: false },
    { shown: "an editor open", help: false, editorOpen: true },
    { shown: "the help open over an editor", help: true, editorOpen: true },
  ])(
    "runs only q while the pane is too small, and every key again once it is not, with $shown",
    async ({ help, editorOpen }) => {
      const { ran, change, screen } = await bind({
        mode: "activity",
        tooSmall: true,
        help,
        editorOpen,
      });
      const drawn = await press(
        screen,
        ...["left", "h", "right", "l", "up", "k", "down", "j"],
        ...["pageup", "pagedown", "home", "end", "return", "a", "r", "g", "t"],
        ...["R", "?", "escape", "q"],
      );
      expect(ran).toEqual(["quit"]);
      expect(drawn.lines.at(0)).toBe("q");
      await screen.redraw(() =>
        change({ tooSmall: false, help: false, editorOpen: false }),
      );
      await press(screen, "j", "t");
      expect(ran.slice(1)).toEqual(["moveSelection 1", "nextWindow"]);
    },
  );

  it("lists the groups in the help's order, from the mode down to the app", async () => {
    const { screen } = await bind();
    expect(screen.lines.at(2)).toBe("Mode List Thread App");
  });
});
