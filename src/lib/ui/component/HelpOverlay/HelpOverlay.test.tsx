import { describe, expect, it, vi } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import HelpOverlay from "./HelpOverlay.js";
import { Keys, Scrolled } from "./HelpOverlay.stories.js";

/** A group's heading at `width`: its name and a rule to the edge. */
const heading = (name: string, width: number) =>
  `${name} ${"─".repeat(width - name.length - 1)}`;

const linesAt = (width: number) => [
  "",
  heading("Mode", width),
  "  ← →  h l switch mode (owed ↔ activity)",
  "           docket opens owed",
  "  g        next grouping",
  "  t        next time window (activity)",
  "           owed: most overdue first",
  "           activity: newest first",
  "",
  heading("List", width),
  "  ↑ ↓  k j move the selection",
  "           (opens the accordion)",
  "",
  heading("App", width),
  "  ?        show or hide help",
  "  R        full refresh",
  "  q        quit",
  "",
  "  windows are counted in working time",
];

describe("HelpOverlay", () => {
  it("lists every key under its group, labels in one column, at 40 columns", async () => {
    const screen = await draw(
      <HelpOverlay {...Keys.args} height={20} />,
      40,
      20,
    );
    const lines = linesAt(40);
    expect(screen.lines.slice(0, lines.length)).toEqual(lines);
  });

  it("draws the group headings, the keys and the labels, none of them bold", async () => {
    const screen = await draw(
      <HelpOverlay {...Keys.args} height={20} />,
      40,
      20,
    );
    expect(screen.look("Mode")).toMatchObject({
      fg: tokens["color.text"],
      bold: false,
    });
    expect(screen.look("← →  h l")?.bold).toBe(false);
    expect(screen.look("switch mode")?.bold).toBe(false);
  });

  it("keeps the same lines at 60 columns, the rules drawn to the wider edge", async () => {
    const screen = await draw(
      <HelpOverlay {...Keys.args} width={60} height={20} />,
      60,
      20,
    );
    const lines = linesAt(60);
    expect(screen.lines.slice(0, lines.length)).toEqual(lines);
  });

  it("opens at its top on a short pane, every line whole, the key lines under the pane counted, dimmed", async () => {
    const screen = await draw(<HelpOverlay {...Keys.args} height={8} />, 40, 8);
    expect(screen.lines).toEqual([
      ...linesAt(40).slice(0, 5),
      "",
      "",
      "  ↓ 5 below",
    ]);
    expect(screen.look("↓ 5 below")?.fg).toBe(tokens["color.text.muted"]);
  });

  it("scrolls as a list does, from the place it is given, the heading of its keys pinned with their place", async () => {
    const onShown = vi.fn();
    const screen = await draw(
      <HelpOverlay {...Scrolled.args} onShown={onShown} />,
      40,
      8,
    );
    expect(screen.lines).toEqual([
      `List · 1 of 1 ${"─".repeat(26)}`,
      "  ↑ ↓  k j move the selection",
      "           (opens the accordion)",
      "",
      heading("App", 40),
      "  ?        show or hide help",
      "  R        full refresh",
      "  ↓ 1 below",
    ]);
    expect(onShown).toHaveBeenLastCalledWith(3, 5);
  });

  it("never cuts the closing note without counting the key line it closes", async () => {
    const screen = await draw(
      <HelpOverlay {...Keys.args} height={18} />,
      40,
      18,
    );
    expect(screen.lines.slice(15)).toEqual([
      "  R        full refresh",
      "",
      "  ↓ 1 below",
    ]);
  });

  it("ends on its last key line when given no closing note, counting no line for it", async () => {
    // Without the note the help takes 17 lines, so it fits 17 whole.
    const screen = await draw(
      <HelpOverlay {...Keys.args} note={undefined} height={17} />,
      40,
      17,
    );
    expect(screen.lines.slice(14)).toEqual([
      "  ?        show or hide help",
      "  R        full refresh",
      "  q        quit",
    ]);
  });

  it("shows its end when told to start past it", async () => {
    const screen = await draw(
      <HelpOverlay {...Keys.args} height={8} first={99} />,
      40,
      8,
    );
    expect(screen.lines).toEqual([
      "",
      heading("App", 40),
      "  ?        show or hide help",
      "  R        full refresh",
      "  q        quit",
      "",
      "  windows are counted in working time",
      "",
    ]);
  });

  it("cuts a label that crosses a narrow pane with an ellipsis", async () => {
    const screen = await draw(
      <HelpOverlay {...Keys.args} width={24} height={20} />,
      24,
      20,
    );
    expect(screen.lines.at(2)).toBe("  ← →  h l switch mode …");
  });
});
