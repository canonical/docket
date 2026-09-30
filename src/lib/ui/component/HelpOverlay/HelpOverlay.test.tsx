import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import HelpOverlay from "./HelpOverlay.js";
import { Keys } from "./HelpOverlay.stories.js";

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
    const screen = await draw(<HelpOverlay {...Keys.args} />, 40, 20);
    const lines = linesAt(40);
    expect(screen.lines.slice(0, lines.length)).toEqual(lines);
  });

  it("draws the group headings, the keys and the labels, none of them bold", async () => {
    const screen = await draw(<HelpOverlay {...Keys.args} />, 40, 20);
    expect(screen.look("Mode")).toMatchObject({
      fg: tokens["color.text"],
      bold: false,
    });
    expect(screen.look("← →  h l")?.bold).toBe(false);
    expect(screen.look("switch mode")?.bold).toBe(false);
  });

  it("keeps the same lines at 60 columns, the rules drawn to the wider edge", async () => {
    const screen = await draw(
      <HelpOverlay {...Keys.args} width={60} />,
      60,
      20,
    );
    const lines = linesAt(60);
    expect(screen.lines.slice(0, lines.length)).toEqual(lines);
  });

  it("cuts off at the bottom of a short pane, every line whole", async () => {
    const screen = await draw(<HelpOverlay {...Keys.args} />, 40, 6);
    expect(screen.lines).toEqual(linesAt(40).slice(0, 6));
  });

  it("wraps a label that crosses a narrow pane in its column, and each note under it", async () => {
    const screen = await draw(
      <HelpOverlay {...Keys.args} width={24} />,
      24,
      20,
    );
    expect(screen.lines.slice(2, 6)).toEqual([
      "  ← →  h l switch mode",
      "           (owed ↔",
      "           activity)",
      "           docket opens",
    ]);
  });
});
